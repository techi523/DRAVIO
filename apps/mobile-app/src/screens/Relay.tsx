import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { onEvent } from '../services/socket';

interface RelayNode {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'offline';
  uptime: string;
  earned: number;
  bandwidth_shared: string;
  peers: number;
}

const DEMO_NODES: RelayNode[] = [
  { id: '1', name: 'Home Router Node', status: 'active', uptime: '14h 32m', earned: 3.20, bandwidth_shared: '8.4 GB', peers: 12 },
  { id: '2', name: 'Office Hotspot', status: 'idle', uptime: '2h 05m', earned: 0.80, bandwidth_shared: '1.2 GB', peers: 3 },
  { id: '3', name: 'Mobile Tethering', status: 'offline', uptime: '—', earned: 0, bandwidth_shared: '0 GB', peers: 0 },
];

export default function Relay() {
  const [isSharing, setIsSharing] = useState(false);
  const [nodes, setNodes] = useState<RelayNode[]>(DEMO_NODES);
  const [liveStats, setLiveStats] = useState({
    today: 4.00,
    week: 18.50,
    allTime: 124.30,
    peers: 12
  });

  // 1. Heartbeat Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSharing) {
      const sendHeartbeat = async () => {
        try {
          await api.post('/marketplace/heartbeat', {
            node_id: '1', // Hardcoded for demo
            status: 'active',
            available_bandwidth: 100, // Mbps
            latency: 15, // ms
            geo: { lat: -1.286389, lon: 36.817223 } // Nairobi
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      };

      sendHeartbeat();
      interval = setInterval(sendHeartbeat, 30000); // Every 30s
    }

    return () => clearInterval(interval);
  }, [isSharing]);

  // 2. WebSocket Logic for Real-time Stats
  useEffect(() => {
    let cleanupEarnings: () => void;
    let cleanupPeers: () => void;

    const setupSocket = async () => {
      cleanupEarnings = await onEvent('earnings_update', (data: { today: number, total: number }) => {
        setLiveStats(prev => ({
          ...prev,
          today: data.today,
          allTime: data.total
        }));
      });

      cleanupPeers = await onEvent('peer_update', (data: { peers: number }) => {
        setLiveStats(prev => ({
          ...prev,
          peers: data.peers
        }));
        
        // Update the primary demo node for visual consistency
        setNodes(curr => curr.map(n => 
          n.id === '1' ? { ...n, peers: data.peers } : n
        ));
      });
    };

    setupSocket();

    return () => {
      if (cleanupEarnings) cleanupEarnings();
      if (cleanupPeers) cleanupPeers();
    };
  }, []);

  const toggleSharing = () => {
    if (!isSharing) {
      Alert.alert('Sharing Started', 'Your node is now visible to the marketplace.');
    }
    setIsSharing(!isSharing);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return Colors.success;
      case 'idle': return '#FFB800';
      default: return Colors.danger;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Toggle Card */}
      <View style={styles.toggleCard}>
        <View>
          <Text style={styles.toggleTitle}>Bandwidth Sharing</Text>
          <Text style={styles.toggleSub}>
            {isSharing ? 'You are earning by sharing bandwidth' : 'Start sharing to earn rewards'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, isSharing && styles.toggleBtnActive]}
          onPress={toggleSharing}
        >
          <View style={[styles.toggleKnob, isSharing && styles.toggleKnobActive]} />
        </TouchableOpacity>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsRow}>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>TODAY</Text>
          <Text style={styles.earningValue}>${liveStats.today.toFixed(2)}</Text>
        </View>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>THIS WEEK</Text>
          <Text style={styles.earningValue}>$18.50</Text>
        </View>
        <View style={styles.earningBox}>
          <Text style={styles.earningLabel}>ALL TIME</Text>
          <Text style={styles.earningValue}>${liveStats.allTime.toFixed(2)}</Text>
        </View>
      </View>

      {/* Active Nodes */}
      <Text style={styles.sectionTitle}>Your Relay Nodes</Text>
      {nodes.map(node => (
        <View key={node.id} style={styles.nodeCard}>
          <View style={styles.nodeHeader}>
            <View style={styles.nodeNameRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(node.status) }]} />
              <Text style={styles.nodeName}>{node.name}</Text>
            </View>
            <Text style={[styles.statusBadge, { color: statusColor(node.status), borderColor: statusColor(node.status) }]}>
              {node.status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.nodeStats}>
            <View>
              <Text style={styles.nodeStatLabel}>Uptime</Text>
              <Text style={styles.nodeStatVal}>{node.uptime}</Text>
            </View>
            <View>
              <Text style={styles.nodeStatLabel}>Shared</Text>
              <Text style={styles.nodeStatVal}>{node.bandwidth_shared}</Text>
            </View>
            <View>
              <Text style={styles.nodeStatLabel}>Peers</Text>
              <Text style={styles.nodeStatVal}>{node.peers}</Text>
            </View>
            <View>
              <Text style={styles.nodeStatLabel}>Earned</Text>
              <Text style={[styles.nodeStatVal, { color: Colors.success }]}>${node.earned.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      ))}

      {/* Add Node Button */}
      <TouchableOpacity style={styles.addNodeBtn}>
        <Text style={styles.addNodeBtnText}>+ ADD RELAY NODE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.background,
  },
  toggleCard: {
    backgroundColor: Colors.surfaceHigh,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,242,255,0.15)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.foreground,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    maxWidth: 200,
  },
  toggleBtn: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(0,242,255,0.3)',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  earningsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  earningBox: {
    flex: 1,
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  earningLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  earningValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.success,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.foreground,
    marginBottom: 16,
  },
  nodeCard: {
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nodeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  nodeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.foreground,
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nodeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nodeStatLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  nodeStatVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.foreground,
  },
  addNodeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0,242,255,0.3)',
    borderStyle: 'dashed',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addNodeBtnText: {
    color: Colors.primary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
});
