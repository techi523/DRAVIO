import React, { createContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  role: 'buyer' | 'seller';
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoredData() {
      try {
        const storedToken = await SecureStore.getItemAsync('dravio_token');
        const storedUser = await SecureStore.getItemAsync('dravio_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.warn('Failed to load auth data', err);
      } finally {
        setLoading(false);
      }
    }

    loadStoredData();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    await SecureStore.setItemAsync('dravio_token', newToken);
    await SecureStore.setItemAsync('dravio_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('dravio_token');
    await SecureStore.deleteItemAsync('dravio_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
