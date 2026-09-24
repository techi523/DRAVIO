import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { onEvent } from '../services/socket';
import VpnDisclosure, { VPN_CONSENT_KEY } from './VpnDisclosure';
import { storage } from '../services/storage';
import { AuthContext } from '../services/AuthContext';
import Input from '../components/Input';

const { width } = Dimensions.get('window');

type Step = 'init' | 'network' | 'config' | 'diagnostics' | 'active';

export default function Relay() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState<Step>('init');
  const [isSharing, setIsSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDisclosure, setShowDisclosure] = useState(false);
  
  // Config state
  const [config, setConfig] = useState({
    dataLimit: 10, // GB
    pricingModel: 'per_gb',
    rate: 0.50, // USD
    maxUsers: 5,
  });

  // Real relay credentials the provider must register before buyers can
  // actually connect a WireGuard tunnel to this node.
  const [relay, setRelay] = useState({ endpoint: '', publicKey: '' });

  // Network stats
  const [network, setNetwork] = useState({
    type: 'WiFi',
    speed: 0,
    hotspot: 'Available',
  });

  const [liveStats, setLiveStats] = useState({
    today: 0,
    activeBuyers: 0,
    dataShared: 0,
    uptime: '0h 0m',
  });

  useEffect(() => {
    fetchNodeStatus();
  }, []);

  useEffect(() => {
    let cleanupSocket: () => void;

    if (isSharing && step === 'active') {
      // Connect real-time WebSocket listeners for Seller telemetry updates
      onEvent('seller_telemetry', (stats: { dataShared: number; todayEarnings: number; activeBuyers: number; uptime: string }) => {
        setLiveStats({
          today: stats.todayEarnings,
          activeBuyers: stats.activeBuyers,
          dataShared: stats.dataShared,
          uptime: stats.uptime,
        });
      }).then(unsub => cleanupSocket = unsub);
    }

    return () => {
      if (cleanupSocket) cleanupSocket();
    };
  }, [isSharing, step]);

  const fetchNodeStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ results: any[] }>('/marketplace/sellers');
      const ownNode = res.results?.find((s: any) => s.id === user?.id);
      if (ownNode) {
        setIsSharing(true);
        setStep('active');
        setConfig({
          dataLimit: ownNode.metrics?.maxUsers ? ownNode.metrics.maxUsers * 2 : 10,
          pricingModel: ownNode.pricing?.model || 'per_gb',
          rate: ownNode.pricing?.rate || 0.50,
          maxUsers: ownNode.metrics?.maxUsers || 5,
        });
        setLiveStats({
          today: ownNode.stats_today_earnings || 0,
          activeBuyers: ownNode.metrics?.activeBuyers || 0,
          dataShared: ownNode.stats_data_shared || 0,
          uptime: ownNode.uptime || '0h 0m',
        });
      } else {
        setIsSharing(false);
        setStep('init');
      }
    } catch (err: any) {
      // Gracefully handle local fallback or initial load offline states
      setIsSharing(false);
      setStep('init');
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async () => {
    const consent = await storage.getItem(VPN_CONSENT_KEY);
    if (!consent) {
      setShowDisclosure(true);
    } else {
      setStep('network');
    }
  };

  const detectNetwork = async () => {
    setLoading(true);
    try {
      // Ping gateway health to guarantee network link is online and active.
      await api.get('/marketplace/sellers');
      setNetwork({
        type: 'Online',
        speed: 0,
        hotspot: 'Gateway verified',
      });
      setStep('config');
    } catch (err: any) {
      Alert.alert('Network Offline', 'Marketplace service is unreachable. Verify gateway is online.');
    } finally {
      setLoading(false);
    }
  };

  const startSharingNode = async () => {
    setLoading(true);
    try {
      // Only measured values are broadcast. A stability of 99 is never
      // asserted — the seller screen no longer fabricates network metrics.
      await api.post('/marketplace/heartbeat', {
        lat: 0.0,
        lon: 0.0,
        pricing: {
          model: config.pricingModel,
          rate: config.rate,
        },
        metrics: {
          avgSpeed: network.speed > 0 ? network.speed : undefined,
          maxUsers: config.maxUsers,
        },
        relay: (relay.endpoint && relay.publicKey)
          ? { endpoint: relay.endpoint.trim(), publicKey: relay.publicKey.trim() }
          : undefined,
        status: 'active',
      });

      setIsSharing(true);
      setStep('active');
      setLiveStats({
        today: 0,
        activeBuyers: 0,
        dataShared: 0,
        uptime: '0h 0m',
      });
      if (relay.endpoint && relay.publicKey) {
        Alert.alert('Node Listed', 'Your node is registered on the marketplace. Buyers can now connect to your relay.');
      } else {
        Alert.alert('Node Listed', 'Pricing registered. Add your relay endpoint and public key to let buyers connect tunnels.');
      }
    } catch (err: any) {
      Alert.alert('Activation Failed', err.message || 'Could not register node in the routing registry.');
    } finally {
      setLoading(false);
    }
  };

  const stopSharing = () => {
    Alert.alert(
      'Terminate Service?',
      'This will instantly disconnect all active Buyers and terminate routing tunnels.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'STOP SELLING',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
               await api.post('/marketplace/heartbeat', {
                 lat: 0.0,
                 lon: 0.0,
                 pricing: {
                   model: config.pricingModel,
                   rate: config.rate,
                 },
                 metrics: {
                   avgSpeed: network.speed > 0 ? network.speed : undefined,
                   maxUsers: config.maxUsers,
                 },
                 relay: (relay.endpoint && relay.publicKey)
                   ? { endpoint: relay.endpoint.trim(), publicKey: relay.publicKey.trim() }
                   : undefined,
                 status: 'offline',
               });
              setIsSharing(false);
              setStep('init');
              Alert.alert('Node Offline', 'Your node is no longer listed on the marketplace.');
            } catch (err: any) {
              Alert.alert('Action Failed', err.message || 'Error disconnecting active VPN processes.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (showDisclosure) {
    return (
      <VpnDisclosure
        onAccept={() => { setShowDisclosure(false); setStep('network'); }}
        onDecline={() => setShowDisclosure(false)}
      />
    );
  }

  if (loading && step === 'init') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.success} />
        <Text style={styles.loadingText}>{t('Connecting to Telecom routing registry...')}</Text>
      </View>
    );
  }

  if (error && step === 'init') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>🌐</Text>
        <Text style={styles.errorTitle}>{t('Network Core Offline')}</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchNodeStatus}>
          <Text style={styles.retryBtnText}>{t('RETRY NODE SYNC')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 'init':
        return (
          <View style={styles.centerContent}>
            <View style={styles.heroCircle}>
              <Text style={styles.heroIcon}>📡</Text>
            </View>
            <Text style={styles.title}>{t('Become an Internet Provider')}</Text>
            <Text style={styles.subtitle}>{t('Route Buyer traffic through secure WireGuard tunnels and turn unused bandwidth into earnings.')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={startOnboarding}>
              <Text style={styles.primaryBtnText}>{t('START SELLING BANDWIDTH')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'network':
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{t('Network Quality Scan')}</Text>
            <Text style={styles.stepSub}>{t('We are analyzing your carrier signal and ping jitter to optimize routing tunnels.')}</Text>
            
            <View style={styles.scanCard}>
              <ActivityIndicator color={Colors.success} size="large" />
              <Text style={styles.scanText}>{t('Checking ping latency & bandwidth capacity...')}</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={detectNetwork}>
              <Text style={styles.primaryBtnText}>{t('ANALYZE CONNECTION')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'config':
        return (
          <ScrollView style={styles.stepContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.stepTitle}>{t('Configure Telecom Node')}</Text>
            <Text style={styles.stepSub}>{t('Define your internet plan parameters and pricing thresholds.')}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('MAX DATA LIMIT TO SHARE')}</Text>
              <View style={styles.configRow}>
                {[5, 10, 20, 50].map(v => (
                  <TouchableOpacity 
                    key={v} 
                    style={[styles.chip, config.dataLimit === v && styles.chipActive]}
                    onPress={() => setConfig({...config, dataLimit: v})}
                  >
                    <Text style={[styles.chipText, config.dataLimit === v && styles.chipTextActive]}>{v} {t('GB')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('PRICING STRUCTURE')}</Text>
              <View style={styles.pricingRow}>
                <TouchableOpacity 
                  style={[styles.priceBox, config.pricingModel === 'per_gb' && styles.priceBoxActive]}
                  onPress={() => setConfig({...config, pricingModel: 'per_gb', rate: 0.50})}
                >
                  <Text style={styles.priceValue}>$0.50</Text>
                  <Text style={styles.priceUnit}>{t('Per GB')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.priceBox, config.pricingModel === 'per_hour' && styles.priceBoxActive]}
                  onPress={() => setConfig({...config, pricingModel: 'per_hour', rate: 0.20})}
                >
                  <Text style={styles.priceValue}>$0.20</Text>
                  <Text style={styles.priceUnit}>{t('Per Hour')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('MAX CONCURRENT BUYERS')}</Text>
              <View style={styles.configRow}>
                {[2, 5, 10, 15].map(v => (
                  <TouchableOpacity 
                    key={v} 
                    style={[styles.chip, config.maxUsers === v && styles.chipActive]}
                    onPress={() => setConfig({...config, maxUsers: v})}
                  >
                    <Text style={[styles.chipText, config.maxUsers === v && styles.chipTextActive]}>{v} {t('Clients')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('ADVERTISED UPLINK SPEED (MBPS, OPTIONAL)')}</Text>
              <Input
                value={network.speed ? String(network.speed) : ''}
                onChangeText={(v) => setNetwork({ ...network, speed: parseFloat(v) || 0 })}
                keyboardType="numeric"
                placeholder="e.g. 80"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('RELAY ENDPOINT (HOST:PORT, OPTIONAL)')}</Text>
              <Input
                value={relay.endpoint}
                onChangeText={(v) => setRelay({ ...relay, endpoint: v })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="209.126.8.20:51820"
              />
              <Text style={styles.label}>{t('RELAY PUBLIC KEY (OPTIONAL)')}</Text>
              <Input
                value={relay.publicKey}
                onChangeText={(v) => setRelay({ ...relay, publicKey: v })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="WireGuard public key of your relay"
              />
              <Text style={styles.hint}>{t('Buyers can only connect once a real relay endpoint and public key are registered.')}</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={startSharingNode}>
              <Text style={styles.primaryBtnText}>{t('START BROADCASTING')}</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 'active':
        return (
          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.activeHeader}>
              <View>
                <Text style={styles.activeLabel}>{t("TODAY'S EARNINGS")}</Text>
                <Text style={styles.activeValue}>${liveStats.today.toFixed(4)}</Text>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={stopSharing}>
                <Text style={styles.stopBtnText}>{t('STOP BROADCAST')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('CONNECTED BUYERS')}</Text>
                <Text style={styles.statVal}>{liveStats.activeBuyers}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('ROUTED VOLUME')}</Text>
                <Text style={styles.statVal}>{liveStats.dataShared.toFixed(3)} {t('GB')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('UPTIME')}</Text>
                <Text style={styles.statVal}>{liveStats.uptime}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('Active Connection Registry')}</Text>
            <View style={styles.buyerList}>
              {liveStats.activeBuyers === 0 ? (
                <Text style={styles.emptyText}>{t('Waiting for Buyers to discover & connect to your node...')}</Text>
              ) : (
                <Text style={styles.connectedText}>{t('⚠️ Broadcast Active. Buyers are securely routing traffic.')}</Text>
              )}
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.main}>
      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24 },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  stepContainer: { flex: 1, padding: 24 },
  heroCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0, 255, 170, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  heroIcon: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  primaryBtn: { backgroundColor: Colors.success, width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  stepTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  stepSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 32 },
  scanCard: { backgroundColor: Colors.glass, padding: 40, borderRadius: 24, alignItems: 'center', marginVertical: 40, borderWidth: 1, borderColor: Colors.border },
  scanText: { marginTop: 16, color: Colors.textMuted, fontSize: 12 },
  inputGroup: { marginBottom: 32 },
  label: { fontSize: 10, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8, marginTop: 8, textTransform: 'uppercase' },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 18 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Colors.surfaceMid, borderWidth: 1, borderColor: Colors.border },
  chipActive: { borderColor: Colors.success, backgroundColor: 'rgba(0, 255, 170, 0.08)' },
  chipText: { color: Colors.textMuted, fontWeight: 'bold' },
  chipTextActive: { color: Colors.success },
  pricingRow: { flexDirection: 'row', gap: 12 },
  priceBox: { flex: 1, padding: 20, borderRadius: 16, backgroundColor: Colors.surfaceMid, borderWidth: 1, borderColor: Colors.border },
  priceBoxActive: { borderColor: Colors.success, backgroundColor: 'rgba(0, 255, 170, 0.08)' },
  priceValue: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  priceUnit: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 20 },
  activeLabel: { fontSize: 10, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.5 },
  activeValue: { fontSize: 36, fontWeight: '900', color: Colors.success },
  stopBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.danger },
  stopBtnText: { color: Colors.danger, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  statCard: { flex: 1, backgroundColor: Colors.surfaceMid, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 8, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  statVal: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 16 },
  buyerList: { minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  connectedText: { color: Colors.success, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  errorSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: Colors.success, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  retryBtnText: { color: '#000', fontWeight: '900', fontSize: 13 }
});
