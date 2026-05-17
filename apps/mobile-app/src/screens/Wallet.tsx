import React, { useEffect, useState, useContext } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { onEvent } from '../services/socket';
import { AuthContext } from '../services/AuthContext';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
}

export default function Wallet() {
  const { user } = useContext(AuthContext);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Buyer Topup Modal State
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100'); // KES
  const [depositLoading, setDepositLoading] = useState(false);

  // Seller Payout Modal State
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('10'); // USD
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const isSeller = user?.role === 'seller';
  const themeAccent = isSeller ? Colors.success : Colors.primary;

  useEffect(() => {
    fetchWalletData();

    // Listen for real-time balance socket updates
    let cleanupSocket: () => void;
    onEvent('balance_update', (data: { balance: number }) => {
      setBalance(data.balance);
    }).then(unsub => cleanupSocket = unsub);

    return () => {
      if (cleanupSocket) cleanupSocket();
    };
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    setError('');
    try {
      const balRes = await api.get<any>('/wallet/balance');
      setBalance(balRes.balance ?? 0);

      const txRes = await api.get<any[]>('/wallet/transactions');
      setTransactions(
        txRes.map((tx: any) => ({
          id: tx.id,
          type: tx.type, // 'credit' or 'debit'
          amount: tx.amount,
          description: tx.description,
          created_at: tx.created_at || new Date().toISOString()
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Unable to sync with billing server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to deposit.');
      return;
    }

    setDepositLoading(true);
    try {
      await api.post('/wallet/deposit', { amount: amt });
      setShowDeposit(false);
      Alert.alert(
        'STK Push Sent',
        'Please complete the transaction by entering your M-Pesa PIN on your phone.'
      );
      // Re-fetch to synchronize state
      setTimeout(fetchWalletData, 5000);
    } catch (err: any) {
      Alert.alert('Deposit Failed', err.message || 'Could not initialize STK Push.');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }

    if (amt > balance) {
      Alert.alert('Insufficient Balance', 'You cannot withdraw more than your current earnings.');
      return;
    }

    setWithdrawLoading(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt });
      setShowWithdraw(false);
      Alert.alert('Payout Requested', 'Your withdrawal request has been sent for instant processing.');
      fetchWalletData();
    } catch (err: any) {
      Alert.alert('Withdrawal Failed', err.message || 'Payout request declined by bank gateway.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={themeAccent} />
        <Text style={styles.loadingText}>Synchronizing Ledger balances...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>💳</Text>
        <Text style={styles.errorTitle}>Billing Core Offline</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: themeAccent }]} onPress={fetchWalletData}>
          <Text style={styles.retryBtnText}>RETRACT FROM LEDGER</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isSeller ? 'Earnings & Payouts' : 'Digital Wallet'}</Text>
          <Text style={styles.headerSub}>REAL-TIME TRANSACTION LEDGER</Text>
        </View>

        <View style={[styles.balanceCard, isSeller && styles.balanceCardSeller]}>
          <Text style={styles.balanceLabel}>
            {isSeller ? 'TOTAL EARNINGS' : 'AVAILABLE SPENDING BALANCE'}
          </Text>
          <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
          
          <View style={styles.actionsRow}>
            {!isSeller ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: themeAccent }]} onPress={() => setShowDeposit(true)}>
                <Text style={styles.actionBtnText}>DEPOSIT FUNDS</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: themeAccent }]} onPress={() => setShowWithdraw(true)}>
                <Text style={styles.actionBtnText}>WITHDRAW EARNINGS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent transactions recorded on this account.</Text>
          </View>
        ) : (
          transactions.map(tx => (
            <View key={tx.id} style={styles.txItem}>
              <View
                style={[
                  styles.txIcon,
                  { backgroundColor: tx.type === 'credit' ? 'rgba(0, 255, 170, 0.08)' : 'rgba(255, 51, 102, 0.08)' }
                ]}
              >
                <Text style={{ color: tx.type === 'credit' ? Colors.success : Colors.danger }}>
                  {tx.type === 'credit' ? '▲' : '▼'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.type === 'credit' ? Colors.success : Colors.danger }]}>
                {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Buyer Deposit Modal */}
      <Modal visible={showDeposit} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>M-Pesa Express Deposit</Text>
            <Text style={styles.sheetSub}>Enter deposit amount in KES. Funds are converted instantly to USD.</Text>
            
            <View style={styles.inputWrap}>
              <Text style={styles.currency}>KES</Text>
              <TextInput
                style={styles.input}
                value={depositAmount}
                onChangeText={setDepositAmount}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: themeAccent }]} onPress={handleDeposit} disabled={depositLoading}>
              {depositLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>CONFIRM DEPOSIT</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeposit(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Seller Withdrawal Modal */}
      <Modal visible={showWithdraw} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Withdraw Earnings</Text>
            <Text style={styles.sheetSub}>Request payout from your earnings wallet. Funds are transferred to your payout account.</Text>
            
            <View style={styles.inputWrap}>
              <Text style={styles.currency}>USD</Text>
              <TextInput
                style={styles.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: themeAccent }]} onPress={handleWithdraw} disabled={withdrawLoading}>
              {withdrawLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>INITIATE PAYOUT</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWithdraw(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  header: { marginBottom: 32, marginTop: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 9, color: Colors.textMuted, marginTop: 4, letterSpacing: 1 },
  balanceCard: {
    backgroundColor: Colors.surfaceHigh,
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 40
  },
  balanceCardSeller: {
    borderColor: 'rgba(0, 255, 170, 0.15)',
    backgroundColor: 'rgba(0, 255, 170, 0.02)'
  },
  balanceLabel: { fontSize: 10, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  balanceAmount: { fontSize: 48, fontWeight: '900', color: '#FFF', marginBottom: 28 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  actionBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 20 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMid,
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  txDesc: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
  txDate: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  txAmount: { fontSize: 16, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.border
  },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  sheetSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 32, lineHeight: 20 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMid,
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border
  },
  currency: { fontSize: 18, fontWeight: '900', color: Colors.foreground, marginRight: 12 },
  input: { flex: 1, height: 60, fontSize: 24, fontWeight: '900', color: '#FFF' },
  primaryBtn: { padding: 20, borderRadius: 16, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
  cancelBtn: { padding: 20, alignItems: 'center' },
  cancelBtnText: { color: Colors.textMuted, fontWeight: 'bold' },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  errorSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 24 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  retryBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  emptyCard: {
    backgroundColor: Colors.surfaceMid,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' }
});
