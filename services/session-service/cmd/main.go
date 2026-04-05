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
	"github.com/segmentio/kafka-go"
)

var (
	kafkaWriter  *kafka.Writer
	relayManager *orchestrator.RelayManager
	handoffMgr   *orchestrator.HandoffManager
)

func initServices() {
	relayManager = orchestrator.NewRelayManager()
	handoffMgr = &orchestrator.HandoffManager{RelayManager: relayManager}

	// Add mock relay nodes
	relayManager.AddNode(&orchestrator.RelayNode{
		ID:        "relay_af_01",
		Region:    "Africa",
		Endpoint:  "154.12.34.56:51820",
		PublicKey: "relay_public_key_abc",
		LoadPct:   10.5,
	})

	kafkaWriter = &kafka.Writer{
		Addr:     kafka.TCP(os.Getenv("KAFKA_URL")),
		Topic:    "dm.session.started",
		Balancer: &kafka.LeastBytes{},
	}
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
			BuyerID   string `json:"buyer_id"`
			SellerID  string `json:"seller_id"`
			Region    string `json:"region"`
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
		
		// 3. Emit Kafka event
		msg, _ := json.Marshal(map[string]string{
			"session_id": sessionID,
			"buyer_id":   req.BuyerID,
			"seller_id":  req.SellerID,
			"status":    "STARTED",
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

		return c.JSON(http.StatusOK, result)
	})

	// Get active sessions
	e.GET("/v1/sessions/active", func(c echo.Context) error {
		// Mock active sessions for now
		return c.JSON(http.StatusOK, []map[string]interface{}{
			{
				"session_id": uuid.New().String(),
				"seller_id":  "relay_af_01",
				"status":     "ACTIVE",
				"start_time": time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
			},
		})
	})

	// End session
	e.POST("/v1/sessions/:id/end", func(c echo.Context) error {
		sessionID := c.Param("id")
		return c.JSON(http.StatusOK, map[string]string{
			"session_id": sessionID,
			"status":     "COMPLETED",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3005"
	}
	e.Start(":" + port)
}
