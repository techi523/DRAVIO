package orchestrator

import (
	"testing"
)

func TestRelaySelection(t *testing.T) {
	mgr := NewRelayManager()
	mgr.AddNode(&RelayNode{ID: "node1", Region: "Africa", LoadPct: 10.0})
	mgr.AddNode(&RelayNode{ID: "node2", Region: "Africa", LoadPct: 50.0})

	selected := mgr.SelectBestRelay("Africa")
	if selected == nil {
		t.Fatal("Expected a relay to be selected")
	}
	if selected.ID != "node1" {
		t.Errorf("Expected node1 (lower load), got %s", selected.ID)
	}
}

func TestHandoffLogic(t *testing.T) {
	mgr := NewRelayManager()
	hMgr := &HandoffManager{RelayManager: mgr}
	if hMgr.RelayManager == nil {
		t.Fatal("Handoff manager failed to link RelayManager")
	}
}
