import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, Switch } from 'react-native';
import { Colors } from '../theme/colors';
import { useThemeColors } from '../theme/useThemeColors';
import Input from '../components/Input';
import { api } from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { storage } from '../services/storage';

export default function Profile() {
  const t = (str: string) => str;
  const colors = useThemeColors();
  const { logout } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [kycVerification, setKycVerification] = useState<number | null>(null);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    country: ''
  });

  const [editData, setEditData] = useState({ ...profile });
  const [payoutData, setPayoutData] = useState({ method: '', account: '' });
  const [securityData, setSecurityData] = useState({ twoFactor: false, biometric: false });
  const [alertsData, setAlertsData] = useState({ usage: true, drops: true, autoKill: false });
  const [optimizerData, setOptimizerData] = useState({ maxBandwidth: '100', concurrentUsers: '10', autoThrottle: true });
  const [stats, setStats] = useState({ rating: '—', sales: '—', uptime: '—' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
        setLoading(true);
        const data = await api.get<any>('/users/me');
        if (data?.profile) {
            const p = {
                name: data.profile.full_name || '',
                email: data.profile.email || '',
                country: data.profile.country_code || ''
            };
            setProfile(p);
            setEditData(p);
            setIsSeller(!!data.profile.is_seller);
            setKycVerification(data.profile.kyc_level ?? null);
        }
        // Fetch real stats
        try {
            const statsData = await api.get<any>('/users/me/stats');
            if (statsData) {
                setIsSeller(statsData.is_seller ?? isSeller);
                setStats({
                    rating: statsData.rating?.toFixed(1) || '—',
                    sales: statsData.total_sales?.toString() || '—',
                    uptime: statsData.uptime_pct ? `${Math.round(statsData.uptime_pct)}%` : '—'
                });
            }
        } catch (_err) {
            // Stats endpoint may not exist yet
        }
    } catch (_err) {
        // Profile will show empty/loading state
    } finally {
        setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
        await api.put('/users/me', {
            full_name: editData.name,
            country_code: editData.country
        });
        setProfile({ ...editData });
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
        setLoading(false);
    }
  };

  const handleSavePayout = async () => {
      // There is no server-side payout-defaults endpoint on this backend yet.
      // Claiming success here would be fabricated — surface the real state.
      setIsPayoutOpen(false);
      Alert.alert(
        'Not Available Yet',
        'Payout preferences are not stored on the server in this build. To withdraw earnings, use the Wallet screen.'
      );
  };

  return (
    <View style={[styles.main, { backgroundColor: colors.background }]}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Profile Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.avatarContainer} onPress={() => setIsEditing(true)}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{profile.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={styles.editBadge}>
                        <Text style={styles.editIcon}>✎</Text>
                    </View>
                </TouchableOpacity>
                <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
                <Text style={[styles.email, { color: colors.textMuted }]}>{profile.email}</Text>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{isSeller ? t('RELAY NODE PROVIDER') : t('BUYER ACCOUNT')}</Text>
                </View>

                {/* Verification Tags — driven by real server fields only */}
                {(kycVerification ?? 0) > 0 && (
                <View style={styles.tagRow}>
                    <View style={[styles.tag, { borderColor: Colors.success, backgroundColor: 'rgba(0, 255, 170, 0.05)' }]}>
                        <Text style={[styles.tagText, { color: Colors.success }]}>{t('✓ VERIFIED ID')}</Text>
                    </View>
                </View>
                )}
            </View>

            {/* Stats Summary */}
            <View style={styles.statsRow}>
                <View style={[styles.miniStat, { backgroundColor: colors.surfaceLow, borderColor: colors.border }]}>
                    <Text style={[styles.miniStatVal, { color: colors.foreground }]}>{stats.rating}</Text>
                    <Text style={[styles.miniStatLabel, { color: colors.textMuted }]}>{t('Rating')}</Text>
                </View>
                <View style={[styles.miniStat, { backgroundColor: colors.surfaceLow, borderColor: colors.border }]}>
                    <Text style={[styles.miniStatVal, { color: colors.foreground }]}>{stats.sales}</Text>
                    <Text style={[styles.miniStatLabel, { color: colors.textMuted }]}>{t('Sales')}</Text>
                </View>
                <View style={[styles.miniStat, { backgroundColor: colors.surfaceLow, borderColor: colors.border }]}>
                    <Text style={[styles.miniStatVal, { color: colors.foreground }]}>{stats.uptime}</Text>
                    <Text style={[styles.miniStatLabel, { color: colors.textMuted }]}>{t('Uptime')}</Text>
                </View>
            </View>

            {/* Settings Sections */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('Account Control')}</Text>
            <View style={[styles.section, { backgroundColor: colors.surfaceLow, borderColor: colors.border }]}>
                <ProfileRow icon="👤" label={t('Personal Identity')} sub={t('Manage your KYC and profile')} onPress={() => setIsEditing(true)} />
                <ProfileRow icon="💳" label={t('Payout Settings')} sub={t('Bank, M-Pesa, or Crypto')} onPress={() => setIsPayoutOpen(true)} />
                <ProfileRow icon="🛡️" label={t('Security Vault')} sub={t('2FA and Encryption keys')} onPress={() => setIsSecurityOpen(true)} isLast />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('System Preferences')}</Text>
            <View style={[styles.section, { backgroundColor: colors.surfaceLow, borderColor: colors.border }]}>
                <ProfileRow icon="🔔" label={t('Intelligent Alerts')} sub={t('Real-time session notifications')} onPress={() => setIsAlertsOpen(true)} />
                <ProfileRow icon="📊" label={t('Traffic Optimizer')} sub={t('Auto-adjust speed and limits')} onPress={() => setIsOptimizerOpen(true)} isLast />
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() =>
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to deactivate this session?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'SIGN OUT',
                      style: 'destructive',
                      onPress: () => logout(),
                    },
                  ]
                )
              }
            >
                <Text style={styles.logoutBtnText}>{t('DEACTIVATE SESSION (LOGOUT)')}</Text>
            </TouchableOpacity>
        </ScrollView>

        {/* Edit Profile Modal */}
        <Modal visible={isEditing} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={[styles.editSheet, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t('Edit Profile')}</Text>
                    
                    <Input 
                        label={t('FULL NAME')}
                        value={editData.name} 
                        onChangeText={(t) => setEditData({ ...editData, name: t })}
                    />

                    <Input 
                        label={t('COUNTRY CODE')}
                        value={editData.country} 
                        onChangeText={(t) => setEditData({ ...editData, country: t.toUpperCase() })}
                        maxLength={2}
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={loading}>
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t('SAVE CHANGES')}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                        <Text style={styles.cancelBtnText}>{t('CANCEL')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Payout Settings Modal */}
        <Modal visible={isPayoutOpen} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={[styles.editSheet, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t('Payout Settings')}</Text>
                    
                    <Input 
                        label={t('PRIMARY METHOD')}
                        value={payoutData.method} 
                        onChangeText={(t) => setPayoutData({ ...payoutData, method: t })}
                    />

                    <Input 
                        label={t('ACCOUNT / WALLET DETAILS')}
                        value={payoutData.account} 
                        onChangeText={(t) => setPayoutData({ ...payoutData, account: t })}
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSavePayout} disabled={loading}>
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t('UPDATE PAYOUT')}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPayoutOpen(false)}>
                        <Text style={styles.cancelBtnText}>{t('CANCEL')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Security Vault Modal */}
        <Modal visible={isSecurityOpen} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={[styles.editSheet, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t('Security Vault')}</Text>
                    <Text style={{color: colors.textMuted, marginBottom: 24, fontSize: 13}}>{t('Manage your account security and encryption keys.')}</Text>
                    
                    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('Two-Factor Auth (2FA)')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('Use Authenticator App')}</Text>
                        </View>
<Switch
                            value={securityData.twoFactor}
                            onValueChange={(val) => {
                              setSecurityData({ ...securityData, twoFactor: val });
                              storage.setItem('dravio_pref_twofactor', val ? '1' : '0');
                            }}
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('Biometric Login')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('FaceID / Fingerprint (saved on this device)')}</Text>
                        </View>
                        <Switch
                            value={securityData.biometric}
                            onValueChange={(val) => {
                              setSecurityData({ ...securityData, biometric: val });
                              storage.setItem('dravio_pref_biometric', val ? '1' : '0');
                            }}
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, {backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.danger, marginTop: 32}]} onPress={() => Alert.alert('No Relay Key Store', 'Encryption keys are rotated by your relay service provider. This build does not expose server-side key rotation.')}>
                        <Text style={[styles.saveBtnText, {color: Colors.danger}]}>{t('ROTATE ENCRYPTION KEYS')}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsSecurityOpen(false)}>
                        <Text style={styles.cancelBtnText}>{t('DONE')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Intelligent Alerts Modal */}
        <Modal visible={isAlertsOpen} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={[styles.editSheet, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t('Intelligent Alerts')}</Text>
                    <Text style={{color: colors.textMuted, marginBottom: 24, fontSize: 13}}>{t('Manage real-time notifications for your relay node.')}</Text>
                    
                    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('High Usage Warnings')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('Alert when hitting 90% capacity')}</Text>
                        </View>
                        <Switch 
                            value={alertsData.usage} 
                            onValueChange={(val) => setAlertsData({...alertsData, usage: val})} 
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('Connection Drops')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('Notify if node goes offline')}</Text>
                        </View>
                        <Switch 
                            value={alertsData.drops} 
                            onValueChange={(val) => setAlertsData({...alertsData, drops: val})} 
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('Zero Balance Auto-Kill')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('Alert when a buyer is auto-disconnected')}</Text>
                        </View>
                        <Switch 
                            value={alertsData.autoKill} 
                            onValueChange={(val) => setAlertsData({...alertsData, autoKill: val})} 
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, {marginTop: 32}]} onPress={() => {
                      storage.setItem('dravio_pref_alerts', JSON.stringify(alertsData));
                      setIsAlertsOpen(false);
                      Alert.alert('Saved on Device', 'Alert preferences are stored locally only.');
                    }}>
                        <Text style={styles.saveBtnText}>{t('DONE')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Traffic Optimizer Modal */}
        <Modal visible={isOptimizerOpen} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={[styles.editSheet, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t('Traffic Optimizer')}</Text>
                    <Text style={{color: colors.textMuted, marginBottom: 24, fontSize: 13}}>{t('Fine-tune your node\'s performance and bandwidth limits.')}</Text>
                    
                    <Input 
                        label={t('MAX BANDWIDTH (MBPS)')}
                        value={optimizerData.maxBandwidth} 
                        onChangeText={(t) => setOptimizerData({ ...optimizerData, maxBandwidth: t })}
                        keyboardType="numeric"
                    />

                    <Input 
                        label={t('CONCURRENT USERS LIMIT')}
                        value={optimizerData.concurrentUsers} 
                        onChangeText={(t) => setOptimizerData({ ...optimizerData, concurrentUsers: t })}
                        keyboardType="numeric"
                    />

                    <View style={[styles.switchRow, {borderBottomWidth: 0, marginTop: 12}]}>
                        <View>
                            <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t('Auto-Throttle')}</Text>
                            <Text style={[styles.switchSub, { color: colors.textMuted }]}>{t('Reduce speed gracefully on high load')}</Text>
                        </View>
                        <Switch 
                            value={optimizerData.autoThrottle} 
                            onValueChange={(val) => setOptimizerData({...optimizerData, autoThrottle: val})} 
                            trackColor={{ false: colors.surfaceMid, true: colors.primary }}
                        />
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, {marginTop: 32}]} onPress={async () => {
                      await storage.setItem('dravio_pref_optimizer', JSON.stringify(optimizerData));
                      setIsOptimizerOpen(false);
                      Alert.alert('Saved on Device', 'Optimizer settings are applied to this device only. They do not alter the relay or billing servers.');
                    }}>
                        <Text style={styles.saveBtnText}>{t('SAVE OPTIMIZATION')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsOptimizerOpen(false)}>
                        <Text style={styles.cancelBtnText}>{t('CANCEL')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

    </View>
  );
}

const ProfileRow = ({ icon, label, sub, isLast, onPress }: any) => {
    const colors = useThemeColors();
    return (
        <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]} onPress={onPress}>
            <View style={[styles.rowIconBox, { backgroundColor: colors.surfaceMid }]}><Text style={styles.rowIcon}>{icon}</Text></View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>{sub}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surfaceMid, borderWidth: 3, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '900', color: Colors.primary },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.background },
  editIcon: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  name: { fontSize: 28, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  email: { fontSize: 14, color: Colors.textMuted, marginBottom: 16 },
  roleBadge: { backgroundColor: 'rgba(112,0,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: Colors.secondary },
  roleText: { color: Colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  miniStat: { flex: 1, backgroundColor: Colors.surfaceLow, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  miniStatVal: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  miniStatLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 16, textTransform: 'uppercase' },
  section: { backgroundColor: Colors.glass, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, marginBottom: 32, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceMid, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  rowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: Colors.textMuted, fontWeight: '300' },
  logoutBtn: { padding: 20, borderRadius: 20, backgroundColor: 'rgba(255, 51, 102, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 51, 102, 0.2)', alignItems: 'center' },
  logoutBtnText: { color: Colors.danger, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, borderWidth: 1, borderColor: Colors.border },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 32 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  input: { backgroundColor: Colors.surfaceMid, borderRadius: 16, padding: 16, fontSize: 16, color: '#FFF', borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary, padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
  cancelBtn: { padding: 20, alignItems: 'center' },
  cancelBtnText: { color: Colors.textMuted, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  switchLabel: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  switchSub: { color: Colors.textMuted, fontSize: 12 },
});



