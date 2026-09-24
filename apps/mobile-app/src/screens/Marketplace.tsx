import { useThemeColors } from '../theme/useThemeColors';
import React, { useEffect, useState, useContext } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, DeviceEventEmitter } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { getDeviceId } from '../services/device';
import { vpnService, VpnStats } from '../services/VpnService';
import { subscribeToPeerUpdates } from '../services/socket';

export default function Marketplace() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const { user } = useContext(AuthContext);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [session, setSession] = useState<VpnStats | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSeller, setActiveSeller] = useState<any | null>(null);

  useEffect(() => {
    fetchSellers();

    const unsubscribe = vpnService.onStatsUpdate(stats => {
      setSession(stats);
      if (stats.status === 'disconnected') {
        setActiveSessionId(null);
      }
    });

    let peerUnsub: (() => void) | undefined;
    subscribeToPeerUpdates((data) => {
      setSellers((prev) => {
        if (data.status === 'offline') {
          return prev.filter((s) => s.id !== data.sellerId);
        }
        
        const existingIdx = prev.findIndex((s) => s.id === data.sellerId);
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...data.sellerData };
          return next;
        } else {
          if (data.sellerData) {
            return [...prev, data.sellerData];
          }
          return prev;
        }
      });
    }).then(unsubFn => { peerUnsub = unsubFn; });

    const reconnectSub = DeviceEventEmitter.addListener('dravio:socket_connected', fetchSellers);

    return () => {
      unsubscribe();
      if (peerUnsub) peerUnsub();
      reconnectSub.remove();
    };
  }, []);

  const fetchSellers = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<any>('/marketplace/search?lat=0&lon=0');
      const sorted = (data.results || []).sort((a: any, b: any) =>
        (a.price_per_gb ?? Number.MAX_VALUE) - (b.price_per_gb ?? Number.MAX_VALUE) || ((b.avg_speed ?? 0) - (a.avg_speed ?? 0))
      );
      setSellers(sorted);
    } catch (err: any) {
      setError(err.message || 'Unable to load connection nodes near you.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = React.useCallback(async (seller: any) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to start a session.');
      return;
    }

    setConnectingId(seller.id);
    setError('');
    try {
      // Paid session start is server-authoritative: the backend resolves the
      // seller price, checks the wallet, and refuses when the seller has no
      // live relay. The returned session token is the billing session id.
      const hardwareId = await getDeviceId();
      const res = await api.post<any>('/billing/sessions/start', {
        hardwareId,
        sellerId: seller.id,
      });

      if (!res.sessionToken || !res.vpn_config) {
        throw new Error('Server did not return a usable session.');
      }

      const success = await vpnService.connect(res.sessionToken, res.vpn_config);
      if (success) {
        setActiveSessionId(res.sessionToken);
        setActiveSeller(seller);
      }
    } catch (err: any) {
      const msg = err.message === 'SELLER_RELAY_NOT_REGISTERED'
        ? 'This provider has not registered a live relay yet.'
        : err.message === 'SELLER_PRICE_UNAVAILABLE'
          ? 'This provider has no active pricing.'
          : err.message || 'Could not establish encrypted VPN tunnel.';
      Alert.alert('Connection Failed', msg);
    } finally {
      setConnectingId(null);
    }
  }, [user]);

  const handleDisconnect = React.useCallback(async () => {
    const token = activeSessionId;
    // Notify billing so the session is finalized and usage stops accruing.
    if (token) {
      try {
        await api.post('/billing/sessions/end', { sessionToken: token });
      } catch (_e) {
        // Best-effort: local disconnect still proceeds.
      }
    }
    await vpnService.disconnect();
    setActiveSessionId(null);
    setActiveSeller(null);
    Alert.alert('Disconnected', 'Your session has ended.');
  }, [activeSessionId]);

  if (loading && sellers.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Searching for peer nodes near you...</Text>
      </View>
    );
  }

  if (error && sellers.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorTitle}>Marketplace Offline</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchSellers}>
          <Text style={styles.retryBtnText}>REFRESH NODES</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Find Fast Internet.</Text>
          <Text style={styles.heroSubTitle}>Instantly connect to community-shared high-speed nodes.</Text>
        </View>

        {activeSessionId && session && (
            <TouchableOpacity style={styles.activeBar} onPress={() => {}}>
                <View style={styles.activeBarLeft}>
                    <Text style={styles.activeBarTitle}>CONNECTED</Text>
                    <Text style={styles.activeBarSub}>{(session.bytesIn / (1024*1024)).toFixed(1)} MB used</Text>
                </View>
                <TouchableOpacity style={styles.discBtnSmall} onPress={handleDisconnect}>
                    <Text style={styles.discBtnText}>DISCONNECT</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Available Marketplace Nodes</Text>
        
        {sellers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No internet providers broadcasting currently in your sector.</Text>
          </View>
        ) : (
          sellers.map((s, idx) => (
            <View key={s.id} style={[styles.card, idx === 0 && styles.featuredCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.relayIcon, { backgroundColor: idx % 2 === 0 ? colors.secondary : colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.relayName}>{s.name || `Node ${String(s.id).slice(0,4)}`}</Text>
                  <Text style={styles.relayMeta}>{s.avg_speed ? `${s.avg_speed} Mbps` : '—'} {'•'} {s.stability ? `${s.stability}% Stability` : 'Stability —'}</Text>
                </View>
                <Text style={styles.priceText}>{s.price_per_gb ? `$${s.price_per_gb.toFixed(2)}/GB` : '—'}</Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.buyBtn, connectingId === s.id && { opacity: 0.7 }]}
                disabled={connectingId !== null || activeSessionId !== null}
                onPress={() => handleConnect(s)}
              >
                {connectingId === s.id ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.buyBtnText}>{activeSessionId ? 'ACTIVE' : 'CONNECT'}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Live Session Telemetry Modal */}
      <Modal visible={!!activeSessionId} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
            <View style={styles.sessionSheet}>
                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Encrypted Session</Text>
                    <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
                </View>
                
                <View style={styles.statsRow}>
                    <View style={styles.bigStat}>
                        <Text style={styles.bigStatLabel}>DATA CONSUMED</Text>
                        <Text style={styles.bigStatVal}>{((session?.bytesIn || 0) / (1024*1024)).toFixed(2)} <Text style={{fontSize: 14}}>MB</Text></Text>
                    </View>
                    <View style={styles.bigStat}>
                        <Text style={styles.bigStatLabel}>SESSION COST</Text>
                        <Text style={[styles.bigStatVal, { color: colors.warning }]}>
                          ${(((session?.bytesIn || 0) / (1024 * 1024 * 1024)) * (activeSeller?.price_per_gb ?? 0)).toFixed(4)}
                          <Text style={{fontSize: 12}}> EST.</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.meterRow}>
                    <View style={styles.meter}>
                        <Text style={styles.meterLabel}>LATENCY</Text>
                        <Text style={styles.meterVal}>{session?.latency.toFixed(0)} ms</Text>
                    </View>
                    <View style={styles.meter}>
                        <Text style={styles.meterLabel}>UPTIME</Text>
                        <Text style={styles.meterVal}>{Math.floor((session?.uptime || 0) / 60)}m {(session?.uptime || 0) % 60}s</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.primaryDiscBtn} onPress={handleDisconnect}>
                    <Text style={styles.primaryDiscBtnText}>TERMINATE CONNECTION</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  main: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  hero: { marginBottom: 32 },
  heroTitle: { fontSize: 36, fontWeight: '900', color: colors.foreground, lineHeight: 40 },
  heroSubTitle: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  activeBar: { backgroundColor: colors.primary, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  activeBarLeft: { flex: 1 },
  activeBarTitle: { fontWeight: '900', color: colors.background, fontSize: 12 },
  activeBarSub: { color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: 'bold' },
  discBtnSmall: { backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  discBtnText: { color: colors.foreground, fontSize: 10, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  card: { backgroundColor: colors.surfaceMid, padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  featuredCard: { borderColor: colors.primary, backgroundColor: 'rgba(0, 242, 255, 0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  relayIcon: { width: 44, height: 44, borderRadius: 12, marginRight: 16 },
  relayName: { fontSize: 16, fontWeight: 'bold', color: colors.foreground },
  relayMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  priceText: { fontSize: 18, fontWeight: '900', color: colors.success },
  buyBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  buyBtnText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sessionSheet: { backgroundColor: colors.surfaceHigh, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: colors.foreground },
  liveBadge: { backgroundColor: colors.danger, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: colors.foreground, fontSize: 10, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 32 },
  bigStat: { flex: 1 },
  bigStatLabel: { fontSize: 10, fontWeight: '900', color: colors.textMuted, marginBottom: 4 },
  bigStatVal: { fontSize: 32, fontWeight: '900', color: colors.foreground },
  meterRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 24, marginBottom: 24 },
  meter: { flex: 1 },
  meterLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  meterVal: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
  primaryDiscBtn: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.danger, padding: 20, borderRadius: 16, alignItems: 'center' },
  primaryDiscBtnText: { color: colors.danger, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground, marginBottom: 8 },
  errorSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  retryBtnText: { color: colors.background, fontWeight: '900', fontSize: 13 },
  emptyCard: { backgroundColor: colors.surfaceMid, padding: 32, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' }
});
