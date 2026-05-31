import React, { useState, useContext } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useThemeColors } from '../theme/useThemeColors';
import Input from '../components/Input';
import { api } from '../services/api';
import { AuthContext } from '../services/AuthContext';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

export default function Register({ navigation }: any) {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (!agreed) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.post<{ token: string; user: any }>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      await login(data.token, data.user);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('timed out') || msg.includes('Network request failed')) {
        setError('Cannot reach the server. Check your connection.');
      } else if (msg.includes('409') || msg.toLowerCase().includes('already')) {
        setError('An account with this email already exists.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>DRAVIO</Text>
        <Text style={styles.subtitle}>Create Your Account</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <Input
          label="EMAIL"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          accessibilityLabel="Email address"
        />

        <Input
          label="PASSWORD"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          passwordToggle
          accessibilityLabel="Password"
        />

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>I WANT TO</Text>
          <View style={styles.roleToggles}>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                { backgroundColor: colors.surfaceMid, borderColor: colors.border },
                role === 'buyer' && { borderColor: colors.primary, backgroundColor: 'rgba(0,242,255,0.08)' }
              ]}
              onPress={() => setRole('buyer')}
              accessibilityLabel="Buy internet data"
              accessibilityRole="radio"
            >
              <Text style={styles.roleIcon}>📱</Text>
              <Text style={[styles.roleBtnText, { color: colors.textMuted }, role === 'buyer' && { color: colors.primary }]}>BUY DATA</Text>
              <Text style={[styles.roleDesc, { color: colors.textMuted }]}>Use shared internet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                { backgroundColor: colors.surfaceMid, borderColor: colors.border },
                role === 'seller' && { borderColor: colors.primary, backgroundColor: 'rgba(0,242,255,0.08)' }
              ]}
              onPress={() => setRole('seller')}
              accessibilityLabel="Sell internet data"
              accessibilityRole="radio"
            >
              <Text style={styles.roleIcon}>💰</Text>
              <Text style={[styles.roleBtnText, { color: colors.textMuted }, role === 'seller' && { color: colors.primary }]}>SELL DATA</Text>
              <Text style={[styles.roleDesc, { color: colors.textMuted }]}>Share & earn</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms Acceptance — required by Google Play policy */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreed(!agreed)}
          accessibilityLabel="Agree to Terms of Service and Privacy Policy"
          accessibilityRole="checkbox"
        >
          <View style={[styles.checkbox, { borderColor: colors.border }, agreed && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            I agree to the{' '}
            <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => navigation.navigate('Terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => navigation.navigate('Privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, (loading || !agreed) && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading || !agreed}
          accessibilityLabel="Create account"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>CREATE ACCOUNT</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.linkContainer}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>
            Already have an account?{'  '}
            <Text style={styles.linkHighlight}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceMid,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    color: Colors.foreground,
    fontSize: 16,
  },
  roleToggles: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMid,
    alignItems: 'center',
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0,242,255,0.08)',
  },
  roleIcon: { fontSize: 24, marginBottom: 6 },
  roleBtnText: { color: Colors.textMuted, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  roleBtnTextActive: { color: Colors.primary },
  roleDesc: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#000', fontSize: 13, fontWeight: '900' },
  termsText: { flex: 1, color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: '700' },
  btn: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1.5 },
  errorBox: {
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { color: Colors.textMuted, fontSize: 14 },
  linkHighlight: { color: Colors.primary, fontWeight: '700' },
});
