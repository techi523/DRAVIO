import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../theme/colors';

export default function TunnelMonitor() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Active Session</Text>
          <Text style={styles.nodeName}>Alpha Relay #01</Text>
        </View>
        <View style={styles.pulseContainer}>
          <View style={styles.pulse} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>Usage</Text>
          <Text style={styles.statValue}>412.5 <Text style={styles.unit}>MB</Text></Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Speed</Text>
          <Text style={styles.statValue}>12.4 <Text style={styles.unit}>Mbps</Text></Text>
        </View>
      </View>

      <View style={styles.progressBg}>
        <View style={styles.progressFill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceHigh,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,242,255,0.2)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nodeName: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.foreground,
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,242,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pulse: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  liveText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.foreground,
  },
  unit: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  progressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '40%',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowRadius: 5,
    shadowOpacity: 0.5,
  }
});
