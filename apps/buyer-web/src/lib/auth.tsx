"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, type UserProfile } from "./api";

// ─── Types ─────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  role: "buyer" | "seller" | "admin";
  profile?: UserProfile;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    full_name: string
  ) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// ─── Provider ──────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("dravio_access_token");
      const storedUser = localStorage.getItem("dravio_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.warn("[Auth] Failed to restore session:", err);
      localStorage.removeItem("dravio_access_token");
      localStorage.removeItem("dravio_user");
    } finally {
      setLoading(false);
    }
  }, []);

  // Attempt to load user profile from backend after token restore
  useEffect(() => {
    if (token && user && !user.profile) {
      api.user
        .getProfile()
        .then((data) => {
          const updated = { ...user, profile: data.profile };
          setUser(updated);
          localStorage.setItem("dravio_user", JSON.stringify(updated));
        })
        .catch(() => {
          // Profile fetch failed — token may be expired
        });
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.auth.login(email, password);

    // Store token first so subsequent API calls are authenticated
    localStorage.setItem("dravio_access_token", access_token);
    setToken(access_token);

    // Decode JWT payload to extract user info
    const payload = decodeJwt(access_token);
    const newUser: User = {
      id: payload.sub,
      email,
      role: (payload.roles?.[0] as User["role"]) || "buyer",
    };

    // Attempt to fetch full profile
    try {
      const { profile } = await api.user.getProfile();
      newUser.profile = profile;
    } catch {
      // Profile might not exist yet
    }

    localStorage.setItem("dravio_user", JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const register = useCallback(
    async (email: string, password: string, full_name: string) => {
      await api.auth.register(email, password, full_name);
      // Auto-login after registration
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("dravio_access_token");
    localStorage.removeItem("dravio_user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const { profile } = await api.user.getProfile();
      const updated = user ? { ...user, profile } : null;
      if (updated) {
        setUser(updated);
        localStorage.setItem("dravio_user", JSON.stringify(updated));
      }
    } catch {
      // silent
    }
  }, [token, user]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─── JWT Decode (no dependency) ────────────────────────────────────

function decodeJwt(token: string): { sub: string; roles?: string[] } {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return { sub: "" };
  }
}
