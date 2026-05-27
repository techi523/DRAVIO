package orchestrator

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type HandoffManager struct {
	RelayManager *RelayManager
}

type HandoffResult struct {
	Success      bool
	NewSessionID string
	DowntimeMs   int64
}

func (h *HandoffManager) ExecuteAtomicHandoff(sessionID string, newSellerID string) (*HandoffResult, error) {
	startTime := time.Now()

	log.Printf("Initiating atomic handoff for session %s to new seller %s", sessionID, newSellerID)

	// 1. Pre-provision new tunnel on relay
	relay := h.RelayManager.SelectBestRelay("")
	if relay == nil {
		return nil, fmt.Errorf("no relay available for handoff")
	}

	err := h.provisionPeerOnRelay(relay, sessionID, newSellerID)
	if err != nil {
		return nil, fmt.Errorf("relay provisioning failed: %w", err)
	}

	// 2. Perform atomic peer swap via relay management API
	err = h.swapPeerOnRelay(relay, sessionID, newSellerID)
	if err != nil {
		return nil, fmt.Errorf("atomic peer swap failed: %w", err)
	}

	downtime := time.Since(startTime).Milliseconds()

	return &HandoffResult{
		Success:      true,
		NewSessionID: sessionID,
		DowntimeMs:   downtime,
	}, nil
}

// provisionPeerOnRelay calls the relay's management API to pre-configure a new WireGuard peer.
func (h *HandoffManager) provisionPeerOnRelay(relay *RelayNode, sessionID string, sellerID string) error {
	url := fmt.Sprintf("http://%s/api/v1/peers/provision", relay.ManagementEndpoint)

	payload, err := json.Marshal(map[string]string{
		"session_id": sessionID,
		"seller_id":  sellerID,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal provision payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("relay %s unreachable: %w", relay.ID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("relay %s provision failed with status %d", relay.ID, resp.StatusCode)
	}

	log.Printf("Peer provisioned on relay %s for session %s", relay.ID, sessionID)
	return nil
}

// swapPeerOnRelay calls the relay's management API to atomically swap the active peer.
func (h *HandoffManager) swapPeerOnRelay(relay *RelayNode, sessionID string, sellerID string) error {
	url := fmt.Sprintf("http://%s/api/v1/peers/swap", relay.ManagementEndpoint)

	payload, err := json.Marshal(map[string]string{
		"session_id":    sessionID,
		"new_seller_id": sellerID,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal swap payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("relay %s unreachable for swap: %w", relay.ID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("relay %s swap failed with status %d", relay.ID, resp.StatusCode)
	}

	log.Printf("Peer swapped on relay %s for session %s to seller %s", relay.ID, sessionID, sellerID)
	return nil
}
