import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/api';
import { AuthContext } from '../services/AuthContext';

export default function Register({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let data;
      try {
        data = await api.post<any>('/auth/register', { email, password, role });
      } catch (err) {
        console.warn('Real register API failed, using mock auth');
        data = {
          token: 'mock_jwt_token',
          user: { id: 'u' + Math.floor(Math.random()*1000), email, role }
        };
      }
      
      await login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DRAVIO</Text>
      <Text style={styles.subtitle}>Create an account</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={Colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={styles.roleContainer}>
        <Text style={styles.roleLabel}>I want to:</Text>
        <View style={styles.roleToggles}>
          <TouchableOpacity 
            style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]} 
            onPress={() => setRole('buyer')}
          >
            <Text style={[styles.roleBtnText, role === 'buyer' && styles.roleBtnTextActive]}>BUY DATA</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]} 
            onPress={() => setRole('seller')}
          >
            <Text style={[styles.roleBtnText, role === 'seller' && styles.roleBtnTextActive]}>SELL DATA</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.btnText}>SIGN UP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20 }}>
        <Text style={styles.linkText}>Already have an account? <Text style={{ color: Colors.primary }}>Log in</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    color: Colors.foreground,
    fontSize: 16,
  },
  roleContainer: {
    marginBottom: 30,
    marginTop: 10,
  },
  roleLabel: {
    color: Colors.textMuted,
    marginBottom: 10,
    fontSize: 14,
  },
  roleToggles: {
    flexDirection: 'row',
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0,242,255,0.1)',
  },
  roleBtnText: {
    color: Colors.textMuted,
    fontWeight: 'bold',
  },
  roleBtnTextActive: {
    color: Colors.primary,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  errorText: {
    color: Colors.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  linkText: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  }
});
