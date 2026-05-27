package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/dravio/session-service/internal/orchestrator"
	"github.com/dravio/session-service/internal/wireguard"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
)

type Session struct {
	SessionID string    `json:"session_id"`
	BuyerID   string    `json:"buyer_id"`
	SellerID  string    `json:"seller_id"`
	Status    string    `json:"status"`
	StartTime time.Time `json:"start_time"`
	RelayID   string    `json:"relay_id"`
}

var (
	kafkaWriter  *kafka.Writer
	relayManager *orchestrator.RelayManager
	handoffMgr   *orchestrator.HandoffManager
	rdb          *redis.Client
	ctxBg        = context.Background()
)

func initServices() {
	relayManager = orchestrator.NewRelayManager()
	handoffMgr = &orchestrator.HandoffManager{RelayManager: relayManager}

	// Load relay nodes from configuration (URL or file)
	if err := relayManager.LoadRelaysFromConfig(); err != nil {
		fmt.Printf("WARNING: Could not load relay config: %v. Service will start with no relays.\n", err)
	} else {
		nodes := relayManager.GetAllNodes()
		fmt.Printf("Loaded %d relay node(s) from configuration\n", len(nodes))
		for _, n := range nodes {
			fmt.Printf("  -> %s (%s) @ %s [load: %.1f%%]\n", n.ID, n.Region, n.Endpoint, n.LoadPct)
		}
	}

	// Start background health checker
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			relayManager.HealthCheckAll()
		}
	}()

	kafkaWriter = &kafka.Writer{
		Addr:     kafka.TCP(os.Getenv("KAFKA_URL")),
		Topic:    "dm.session.started",
		Balancer: &kafka.LeastBytes{},
	}

	// Initialize Redis Connection
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback to simple address
		opts = &redis.Options{Addr: redisURL}
	}
	rdb = redis.NewClient(opts)
	
	// Test Connection
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Printf("WARNING: Could not connect to Redis: %v. Persistent session storage will be degraded.\n", err)
	} else {
		fmt.Println("Successfully connected to Redis cluster.")
	}
}

func saveSession(s *Session) error {
	val, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return rdb.Set(ctxBg, "session:"+s.SessionID, val, 24*time.Hour).Err()
}

func getSession(sessionID string) (*Session, error) {
	val, err := rdb.Get(ctxBg, "session:"+sessionID).Result()
	if err == redis.Nil {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	var s Session
	if err := json.Unmarshal([]byte(val), &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func main() {
	initServices()
	defer kafkaWriter.Close()

	e := echo.New()

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "session-service",
		})
	})

	e.POST("/v1/sessions", func(c echo.Context) error {
		var req struct {
			BuyerID  string `json:"buyer_id"`
			SellerID string `json:"seller_id"`
			Region   string `json:"region"`
		}
		if err := c.Bind(&req); err != nil {
			return err
		}

		// 1. Select Relay
		region := req.Region
		if region == "" {
			region = "Africa"
		}
		relay := relayManager.SelectBestRelay(region)
		if relay == nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "NO_RELAY_AVAILABLE"})
		}

		// 2. Generate Keys
		priv, _, _ := wireguard.GenerateKeyPair()
		
		sessionID := uuid.New().String()
		
		// 3. Save to Redis
		s := &Session{
			SessionID: sessionID,
			BuyerID:   req.BuyerID,
			SellerID:  req.SellerID,
			Status:    "ACTIVE",
			StartTime: time.Now(),
			RelayID:   relay.ID,
		}
		if err := saveSession(s); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "SESSION_SAVE_FAILED"})
		}

		// 4. Emit Kafka event
		msg, _ := json.Marshal(map[string]string{
			"session_id": sessionID,
			"buyer_id":   req.BuyerID,
			"seller_id":  req.SellerID,
			"status":     "STARTED",
			"relay_id":   relay.ID,
		})
		
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := kafkaWriter.WriteMessages(ctx,
			kafka.Message{Key: []byte(sessionID), Value: msg},
		)
		if err != nil {
			fmt.Printf("Kafka write error: %v\n", err)
		}

		return c.JSON(http.StatusCreated, map[string]string{
			"session_id": sessionID,
			"status":     "active",
			"relay":      relay.Endpoint,
			"vpn_config": wireguard.CreateConfigTemplate(priv, "10.42.1.5/32", relay.Endpoint, relay.PublicKey),
		})
	})

	// Handoff endpoint (triggered or auto-detected)
	e.POST("/v1/sessions/:id/handoff", func(c echo.Context) error {
		sessionID := c.Param("id")
		var req struct {
			NewSellerID string `json:"new_seller_id"`
		}
		if err := c.Bind(&req); err != nil {
			return err
		}

		result, err := handoffMgr.ExecuteAtomicHandoff(sessionID, req.NewSellerID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "HANDOFF_FAILED"})
		}

		// Update session in Redis during handoff
		s, err := getSession(sessionID)
		if err == nil && s != nil {
			s.SellerID = req.NewSellerID
			_ = saveSession(s)
		}

		return c.JSON(http.StatusOK, result)
	})

	// Get active sessions
	e.GET("/v1/sessions/active", func(c echo.Context) error {
		keys, err := rdb.Keys(ctxBg, "session:*").Result()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "REDIS_ERROR"})
		}

		activeList := make([]*Session, 0)
		for _, key := range keys {
			val, err := rdb.Get(ctxBg, key).Result()
			if err != nil {
				continue
			}
			var s Session
			if err := json.Unmarshal([]byte(val), &s); err == nil {
				if s.Status == "ACTIVE" {
					activeList = append(activeList, &s)
				}
			}
		}

		return c.JSON(http.StatusOK, activeList)
	})

	// End session
	e.POST("/v1/sessions/:id/end", func(c echo.Context) error {
		sessionID := c.Param("id")
		
		s, err := getSession(sessionID)
		if err != nil || s == nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "SESSION_NOT_FOUND"})
		}

		s.Status = "COMPLETED"
		if err := saveSession(s); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "SESSION_UPDATE_FAILED"})
		}

		return c.JSON(http.StatusOK, s)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3005"
	}
	e.Start(":" + port)
}
