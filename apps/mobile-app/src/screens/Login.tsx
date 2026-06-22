import React, { useState, useContext } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useThemeColors } from '../theme/useThemeColors';
import Input from '../components/Input';
import SocialLoginButtons from '../components/SocialLoginButtons';
import { api } from '../services/api';
import { AuthContext } from '../services/AuthContext';

export default function Login({ navigation }: any) {
  const t = (str: string) => str;
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('Please enter your email and password.'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.post<{ token: string; user: any }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      await login(data.token, data.user);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('timed out') || msg.includes('Network request failed')) {
        setError(t('Cannot reach the server. Check your internet connection.'));
      } else if (msg.includes('401') || msg.toLowerCase().includes('invalid')) {
        setError(t('Incorrect email or password.'));
      } else {
        setError(msg || t('Login failed. Please try again.'));
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
        <Text style={styles.title}>{t('DRAVIO')}</Text>
        <Text style={styles.subtitle}>{t('Decentralized Internet Marketplace')}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <SocialLoginButtons />

        <Input
          label={t('EMAIL')}
          placeholder={t('you@example.com')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel={t('Email address')}
        />

        <Input
          label={t('PASSWORD')}
          placeholder={t('Your password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          passwordToggle
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          accessibilityLabel={t('Password')}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel={t('Log in')}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>{t('LOG IN')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.linkContainer}
          accessibilityLabel={t('Create a new account')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>
            {t("Don't have an account?")}{'  '}
            <Text style={styles.linkHighlight}>{t('Sign Up')}</Text>
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
    justifyContent: 'center',
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
    marginBottom: 48,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputGroup: { marginBottom: 16 },
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
  btn: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  errorBox: {
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { color: Colors.textMuted, fontSize: 14 },
  linkHighlight: { color: Colors.primary, fontWeight: '700' },
});
