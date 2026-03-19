package orchestrator

import (
	"math"
	"sync"
)

type RelayNode struct {
	ID        string
	Region    string
	Endpoint  string
	PublicKey string
	LoadPct   float64
}

type RelayManager struct {
	mu     sync.RWMutex
	nodes  map[string]*RelayNode
}

func NewRelayManager() *RelayManager {
	return &RelayManager{
		nodes: make(map[string]*RelayNode),
	}
}

func (m *RelayManager) AddNode(node *RelayNode) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nodes[node.ID] = node
}

// SelectBestRelay selects the relay with the lowest combination of load and proximity
func (m *RelayManager) SelectBestRelay(region string) *RelayNode {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var bestNode *RelayNode
	minScore := math.MaxFloat64

	for _, node := range m.nodes {
		if node.Region != region {
			continue
		}

		// Simplified scoring for MVP: lower load wins within the same region
		score := node.LoadPct
		if score < minScore {
			minScore = score
			bestNode = node
		}
	}

	return bestNode
}
