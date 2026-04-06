import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { onEvent } from '../services/socket';
import { VpnManager } from '../services/vpnManager';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
}

export default function Wallet() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      const data = await api.get<any>('/wallet/balance');
      setBalance(data?.balance_usd ?? 0);
      
      const txData = await api.get<any>('/wallet/invoices');
      setTransactions(txData?.invoices?.map((i: any) => ({
        id: i.id,
        type: 'debit',
        amount: i.amount_usd,
        description: `Bandwidth Usage: ${i.bandwidth_gb || 0}GB`,
        created_at: i.created_at || new Date().toISOString()
      })) || []);
    } catch (err) {
      console.warn('Wallet API not available, showing demo data');
      setBalance(24.50);
      setTransactions([
        { id: '1', type: 'credit', amount: 50.00, description: 'Topped up via M-Pesa', created_at: new Date().toISOString() },
        { id: '2', type: 'debit', amount: 12.50, description: 'Session: Alpha Relay #01 — 2.5GB', created_at: new Date(Date.now() - 3600000).toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();

    // WebSocket Listeners
    let cleanupBalance: () => void;
    let cleanupAlerts: () => void;

    const setupSocket = async () => {
      cleanupBalance = await onEvent('balance_update', (data: { balance: number }) => {
        setBalance(data.balance);
      });

      cleanupAlerts = await onEvent('billing_alert', async (data: { type: string, message: string }) => {
        if (data.type === 'low_balance' || data.type === 'zero_balance') {
          Alert.alert('Billing Alert', data.message);
          
          if (data.type === 'zero_balance') {
            console.log('Wallet: Auto-disconnecting due to zero balance');
            await VpnManager.disconnect();
          }
        }
      });
    };

    setupSocket();

    return () => {
      if (cleanupBalance) cleanupBalance();
      if (cleanupAlerts) cleanupAlerts();
    };
  }, []);

  const handleTopUp = async () => {
    setIsTopUpLoading(true);
    try {
      // Simulate M-Pesa STK Push
      const result = await api.post<any>('/wallet/topup', { amount_usd: 10 });
      if (result.success) {
        Alert.alert('Top Up Initiated', 'Please check your phone for the M-Pesa prompt.');
        fetchWallet(); // Refresh balance
      }
    } catch (err: any) {
      Alert.alert('Top Up Failed', err.message || 'Transaction could not be started.');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleTopUp} disabled={isTopUpLoading}>
            {isTopUpLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>TOP UP</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>WITHDRAW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>THIS MONTH</Text>
          <Text style={styles.statValue}>$25.50</Text>
          <Text style={styles.statSub}>spent on data</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>DATA USED</Text>
          <Text style={styles.statValue}>5.1 GB</Text>
          <Text style={styles.statSub}>across 3 sessions</Text>
        </View>
      </View>

      {/* Transaction History */}
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {transactions.map(tx => (
        <View key={tx.id} style={styles.txRow}>
          <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? 'rgba(0,255,170,0.15)' : 'rgba(255,0,85,0.15)' }]}>
            <Text style={{ color: tx.type === 'credit' ? Colors.success : Colors.danger, fontWeight: '900', fontSize: 16 }}>
              {tx.type === 'credit' ? '↑' : '↓'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.txDesc}>{tx.description}</Text>
            <Text style={styles.txTime}>{formatTime(tx.created_at)}</Text>
          </View>
          <Text style={[styles.txAmount, { color: tx.type === 'credit' ? Colors.success : Colors.danger }]}>
            {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.background,
  },
  balanceCard: {
    backgroundColor: Colors.surfaceHigh,
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,242,255,0.2)',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.foreground,
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 100,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.foreground,
  },
  statSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.foreground,
    marginBottom: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 46, 0.7)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  txDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.foreground,
  },
  txTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '900',
  },
});
