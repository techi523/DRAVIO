import { useThemeColors } from '../theme/useThemeColors';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { onEvent } from '../services/socket';

interface LogEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
}

export default function AdminDashboard() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [telemetry, setTelemetry] = useState({
    activeNodes: 0,
    activeTunnels: 0,
    dataSharedGb: 0,
    lockdownActive: false,
  });
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockdownLoading, setLockdownLoading] = useState(false);

  useEffect(() => {
    fetchSystemState();

    // Listen for global real-time SOC security alerts
    let cleanupSocket: () => void;
    onEvent('security_alert', (newEvent: LogEvent) => {
      setLogs((prev) => [newEvent, ...prev].slice(0, 50));
      if (newEvent.level === 'critical') {
        Alert.alert('🚨 SECURITY WARNING', newEvent.message);
      }
    }).then((unsub) => (cleanupSocket = unsub));

    return () => {
      if (cleanupSocket) cleanupSocket();
    };
  }, []);

  const fetchSystemState = async () => {
    setLoading(true);
    setError('');
    try {
      // Hit real backend telemetry endpoints
      const stats = await api.get<any>('/admin/telemetry');
      setTelemetry({
        activeNodes: stats.active_nodes ?? 0,
        activeTunnels: stats.active_tunnels ?? 0,
        dataSharedGb: stats.total_bandwidth_gb ?? 0,
        lockdownActive: stats.lockdown_active ?? false,
      });

      const incidentLogs = await api.get<any[]>('/admin/incidents');
      setLogs(
        incidentLogs.map((log: any) => ({
          id: log.id,
          timestamp: log.created_at || new Date().toISOString(),
          level: log.severity || 'info',
          message: log.description,
        }))
      );
    } catch (err: any) {
      setError(
        err.message || 'Unable to connect to DRAVIO administrative services.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalLockdown = async () => {
    const action = telemetry.lockdownActive ? 'Lift' : 'Trigger';
    Alert.alert(
      '⚠️ CONFIRM PROTOCOL',
      `Are you sure you want to ${action.toLowerCase()} the Global Lockdown Protocol? This propagates instantly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM',
          style: 'destructive',
          onPress: async () => {
            setLockdownLoading(true);
            try {
              const res = await api.post<any>('/admin/lockdown', {
                active: !telemetry.lockdownActive,
              });
              setTelemetry((prev) => ({
                ...prev,
                lockdownActive: res.active,
              }));
              Alert.alert(
                'Protocol Updated',
                `Global lockdown successfully ${res.active ? 'engaged' : 'lifted'}.`
              );
            } catch (err: any) {
              Alert.alert('Action Failed', err.message || 'Protocol request rejected.');
            } finally {
              setLockdownLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.danger} />
        <Text style={styles.loadingText}>Synchronizing Security Operations Center...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorTitle}>Administrative Sync Offline</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchSystemState}>
          <Text style={styles.retryBtnText}>RECONNECT TO SYSTEM</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>SECURITY OPERATIONS CENTER</Text>
        <Text style={styles.subTitle}>TELECOM MANAGEMENT PORTAL • ADMIN</Text>
      </View>

      {/* Global Lockdown Toggle widget */}
      <View
        style={[
          styles.lockdownCard,
          telemetry.lockdownActive && styles.lockdownCardActive,
        ]}
      >
        <View style={styles.lockdownHeader}>
          <Text style={styles.lockdownIcon}>{telemetry.lockdownActive ? '🚨' : '🛡️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lockdownTitle}>
              {telemetry.lockdownActive ? 'SYSTEM IN LOCKDOWN' : 'GLOBAL ENCRYPTION ONLINE'}
            </Text>
            <Text style={styles.lockdownSub}>
              {telemetry.lockdownActive
                ? 'All traffic tunnels have been suspended. Encryption tunnels blocked.'
                : 'All peer-to-peer data nodes operating smoothly.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.lockdownBtn,
            telemetry.lockdownActive ? styles.lockdownBtnActive : styles.lockdownBtnInactive,
          ]}
          onPress={handleGlobalLockdown}
          disabled={lockdownLoading}
          accessibilityLabel="Toggle global network lockdown protocol"
          accessibilityRole="button"
        >
          {lockdownLoading ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <Text style={styles.lockdownBtnText}>
              {telemetry.lockdownActive ? 'DISENGAGE LOCKDOWN' : 'TRIGGER GLOBAL LOCKDOWN'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Telemetry Stats Grid */}
      <Text style={styles.sectionTitle}>Global Network Telemetry</Text>
      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>ACTIVE PEER NODES</Text>
          <Text style={styles.statVal}>{telemetry.activeNodes}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>ACTIVE TUNNELS</Text>
          <Text style={styles.statVal}>{telemetry.activeTunnels}</Text>
        </View>
        <View style={[styles.statCard, { width: '100%' }]}>
          <Text style={styles.statLabel}>TOTAL DATA ROUTED TODAY</Text>
          <Text style={[styles.statVal, { color: colors.primary }]}>
            {telemetry.dataSharedGb.toFixed(2)} GB
          </Text>
        </View>
      </View>

      {/* Incident Log Terminal */}
      <View style={styles.logContainer}>
        <View style={styles.logHeader}>
          <Text style={styles.logHeaderTitle}>Security Operations Logs</Text>
          <View style={styles.activePulse} />
        </View>

        <ScrollView style={styles.logBody} nestedScrollEnabled={true}>
          {logs.length === 0 ? (
            <Text style={styles.emptyLog}>No security threats detected. Network clean.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </Text>
                <Text
                  style={[
                    styles.logLevel,
                    log.level === 'critical' && styles.logCrit,
                    log.level === 'warning' && styles.logWarn,
                  ]}
                >
                  [{log.level.toUpperCase()}]
                </Text>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 24, paddingBottom: 60 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  header: { marginBottom: 32, marginTop: 24 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.foreground,
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  lockdownCard: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  lockdownCardActive: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(255, 51, 102, 0.05)',
  },
  lockdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  lockdownIcon: { fontSize: 32 },
  lockdownTitle: { fontSize: 16, fontWeight: '900', color: colors.foreground, letterSpacing: 0.5 },
  lockdownSub: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  lockdownBtn: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  lockdownBtnActive: {
    backgroundColor: colors.success,
  },
  lockdownBtnInactive: {
    backgroundColor: colors.danger,
  },
  lockdownBtnText: { color: colors.background, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: {
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    width: '48%',
  },
  statLabel: { fontSize: 8, color: colors.textMuted, fontWeight: '900', letterSpacing: 1 },
  statVal: { fontSize: 24, fontWeight: '900', color: colors.foreground, marginTop: 8 },
  logContainer: {
    backgroundColor: '#020309',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  logHeaderTitle: { color: colors.foreground, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  activePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  logBody: { maxHeight: 250, padding: 16 },
  emptyLog: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
  logRow: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  logTime: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 },
  logLevel: { color: colors.primary, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold' },
  logWarn: { color: colors.warning },
  logCrit: { color: colors.danger },
  logMessage: { flex: 1, color: '#DDD', fontFamily: 'monospace', fontSize: 12 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground, marginBottom: 8 },
  errorSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  retryBtnText: { color: colors.background, fontWeight: '900', fontSize: 13 },
});
