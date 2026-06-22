import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { AuthContext } from '../services/AuthContext';
import { Colors } from '../theme/colors';

// In a real implementation with expo-auth-session / @react-native-google-signin/google-signin
// You would import the respective hooks and initialize the flows here.

interface SocialLoginButtonsProps {
  rolePreference?: string;
}

export default function SocialLoginButtons({ rolePreference = 'BUYER' }: SocialLoginButtonsProps) {
  const { oauthLogin, sendOtp, verifyOtp } = useContext(AuthContext);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleProviderLogin = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      console.log(`[SocialAuth] Initiating login for ${provider}...`);
      
      // Placeholder for Expo Auth Session / Google Sign-In SDK
      // const idToken = await GoogleSignin.signIn();
      // await oauthLogin(provider, { id_token: idToken }, rolePreference);
      
      if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
        throw new Error(`${provider} authentication is not fully configured yet.`);
      }

    } catch (err: any) {
      console.warn(err.message || `Failed to login with ${provider}`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handlePhoneSubmit = async () => {
    try {
      if (!otpSent) {
        setLoadingProvider('phone_send');
        await sendOtp(phoneNumber);
        setOtpSent(true);
      } else {
        setLoadingProvider('phone_verify');
        await verifyOtp(phoneNumber, otpCode, rolePreference);
      }
    } catch (err: any) {
      console.warn(err.message || "Phone authentication failed");
    } finally {
      setLoadingProvider(null);
    }
  };

  if (phoneMode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setPhoneMode(false); setOtpSent(false); }}>
            <Text style={styles.backText}>← Back to Social</Text>
          </TouchableOpacity>
          <Text style={styles.titleText}>Phone Auth</Text>
        </View>

        {!otpSent ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1234567890"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.input, { textAlign: 'center', letterSpacing: 5 }]}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.btn, loadingProvider && styles.btnDisabled]} 
          onPress={handlePhoneSubmit}
          disabled={loadingProvider !== null}
        >
          {loadingProvider ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>{otpSent ? 'VERIFY CODE' : 'SEND OTP'}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const providers = [
    { id: 'google', name: 'Google', icon: 'G', bg: '#ffffff', color: '#000000' },
    { id: 'apple', name: 'Apple', icon: '', bg: '#000000', color: '#ffffff' },
    { id: 'github', name: 'GitHub', icon: 'GH', bg: '#24292e', color: '#ffffff' },
    { id: 'microsoft', name: 'Microsoft', icon: 'M', bg: '#00a4ef', color: '#ffffff' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {providers.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.providerBtn, { backgroundColor: p.bg }]}
            onPress={() => handleProviderLogin(p.id)}
            disabled={loadingProvider !== null}
          >
            {loadingProvider === p.id ? (
              <ActivityIndicator color={p.color} size="small" />
            ) : (
              <Text style={[styles.providerIcon, { color: p.color }]}>{p.icon} <Text style={styles.providerName}>{p.name}</Text></Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.phoneBtn}
        onPress={() => setPhoneMode(true)}
        disabled={loadingProvider !== null}
      >
        <Text style={styles.phoneBtnText}>📱 Continue with Phone</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or continue with email</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  titleText: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
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
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  providerBtn: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  providerIcon: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  phoneBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: 4,
  },
  phoneBtnText: {
    color: Colors.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    paddingHorizontal: 10,
    fontSize: 12,
  },
});
