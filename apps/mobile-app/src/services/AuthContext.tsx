import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { storage } from './storage';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin';
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  oauthLogin: (provider: string, tokens: { id_token?: string; access_token?: string }, role?: string) => Promise<void>;
  sendOtp: (phone_number: string) => Promise<void>;
  verifyOtp: (phone_number: string, code: string, role?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoredData() {
      try {
        const storedToken = await storage.getItem('dravio_token');
        const storedUser = await storage.getItem('dravio_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          import('./VpnService').then(m => m.vpnService.recoverSession());
        }
      } catch (err) {
        console.warn('Failed to load auth data', err);
      } finally {
        setLoading(false);
      }
    }

    loadStoredData();

    const listener = DeviceEventEmitter.addListener('SESSION_EXPIRED', () => {
      setToken(null);
      setUser(null);
    });

    return () => {
      listener.remove();
    };
  }, []);

  const login = async (newToken: string, newUser: User) => {
    await storage.setItem('dravio_token', newToken);
    await storage.setItem('dravio_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await storage.deleteItem('dravio_token');
    await storage.deleteItem('dravio_user');
    setToken(null);
    setUser(null);
  };

  const oauthLogin = async (provider: string, tokens: { id_token?: string; access_token?: string }, role = 'BUYER') => {
    const res = await api.post<{ access_token: string; token: string; user: User }>('/auth/oauth', {
      provider,
      ...tokens,
      role_preference: role,
    });
    
    // mobile expects `token` but might return `access_token`
    const newToken = res.token || res.access_token;
    await login(newToken, res.user);
  };

  const sendOtp = async (phone_number: string) => {
    await api.post('/auth/otp/send', { phone_number });
  };

  const verifyOtp = async (phone_number: string, code: string, role = 'BUYER') => {
    const res = await api.post<{ access_token: string; token: string; user: User }>('/auth/otp/verify', {
      phone_number,
      code,
      role_preference: role,
    });
    const newToken = res.token || res.access_token;
    await login(newToken, res.user);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, oauthLogin, sendOtp, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
};
