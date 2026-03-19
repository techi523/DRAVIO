package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/dravio/session-service/internal/orchestrator"
	"github.com/dravio/session-service/internal/wireguard"
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
		
		sessionID := "sess_" + time.Now().Format("20060102150405")
		
		// 3. Emit Kafka event
		msg, _ := json.Marshal(map[string]string{
			"session_id": sessionID,
			"buyer_id":   req.BuyerID,
			"seller_id":  req.SellerID,
			"status":    "STARTED",
			"relay_id":   relay.ID,
		})
		
		kafkaWriter.WriteMessages(context.Background(),
			kafka.Message{Key: []byte(sessionID), Value: msg},
		)

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

	port := os.Getenv("PORT")
	if port == "" {
		port = "3005"
	}
	e.Start(":" + port)
}
