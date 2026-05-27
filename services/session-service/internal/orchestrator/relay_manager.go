package orchestrator

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

type RelayNode struct {
	ID                 string  `json:"id"`
	Region             string  `json:"region"`
	Endpoint           string  `json:"endpoint"`
	PublicKey          string  `json:"public_key"`
	ManagementEndpoint string  `json:"management_endpoint"`
	LoadPct            float64 `json:"load_pct"`
	Healthy            bool    `json:"healthy"`
}

type RelayManager struct {
	mu    sync.RWMutex
	nodes map[string]*RelayNode
}

func NewRelayManager() *RelayManager {
	return &RelayManager{
		nodes: make(map[string]*RelayNode),
	}
}

func (m *RelayManager) AddNode(node *RelayNode) {
	m.mu.Lock()
	defer m.mu.Unlock()
	node.Healthy = true
	m.nodes[node.ID] = node
}

func (m *RelayManager) RemoveNode(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.nodes, id)
}

// SelectBestRelay selects the healthiest relay with the lowest load in the given region.
// If region is empty, selects globally.
func (m *RelayManager) SelectBestRelay(region string) *RelayNode {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var bestNode *RelayNode
	minScore := math.MaxFloat64

	for _, node := range m.nodes {
		if !node.Healthy {
			continue
		}
		if region != "" && node.Region != region {
			continue
		}

		score := node.LoadPct
		if score < minScore {
			minScore = score
			bestNode = node
		}
	}

	return bestNode
}

// LoadRelaysFromConfig loads relay nodes from RELAY_CONFIG_URL or RELAY_CONFIG_FILE.
// In production, this should point to a service registry or config server.
func (m *RelayManager) LoadRelaysFromConfig() error {
	configURL := os.Getenv("RELAY_CONFIG_URL")
	configFile := os.Getenv("RELAY_CONFIG_FILE")

	if configURL != "" {
		return m.loadFromURL(configURL)
	}
	if configFile != "" {
		return m.loadFromFile(configFile)
	}

	return fmt.Errorf("no relay configuration source set. Set RELAY_CONFIG_URL or RELAY_CONFIG_FILE")
}

func (m *RelayManager) loadFromURL(url string) error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("failed to fetch relay config from %s: %w", url, err)
	}
	defer resp.Body.Close()

	var nodes []*RelayNode
	if err := json.NewDecoder(resp.Body).Decode(&nodes); err != nil {
		return fmt.Errorf("failed to parse relay config: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	for _, node := range nodes {
		node.Healthy = true
		m.nodes[node.ID] = node
	}
	return nil
}

func (m *RelayManager) loadFromFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read relay config file %s: %w", path, err)
	}

	var nodes []*RelayNode
	if err := json.Unmarshal(data, &nodes); err != nil {
		return fmt.Errorf("failed to parse relay config: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	for _, node := range nodes {
		node.Healthy = true
		m.nodes[node.ID] = node
	}
	return nil
}

// HealthCheckAll pings each relay's management endpoint and marks unhealthy ones.
func (m *RelayManager) HealthCheckAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	client := &http.Client{Timeout: 5 * time.Second}
	for _, node := range m.nodes {
		url := fmt.Sprintf("http://%s/health", node.ManagementEndpoint)
		resp, err := client.Get(url)
		if err != nil || resp.StatusCode != http.StatusOK {
			node.Healthy = false
		} else {
			node.Healthy = true
			resp.Body.Close()
		}
	}
}

// GetAllNodes returns a snapshot of all relay nodes.
func (m *RelayManager) GetAllNodes() []*RelayNode {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*RelayNode, 0, len(m.nodes))
	for _, n := range m.nodes {
		copy := *n
		result = append(result, &copy)
	}
	return result
}
