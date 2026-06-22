"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  oauthLogin: (provider: string, tokens: { id_token?: string; access_token?: string }, role?: string) => Promise<void>;
  sendOtp: (phone_number: string) => Promise<void>;
  verifyOtp: (phone_number: string, code: string, role?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// ─── JWT Decode (no dependency) ────────────────────────────────────

function decodeJwt(token: string): { sub: string; roles?: string[]; exp?: number } {
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

// ─── Provider ──────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any scheduled token refresh
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Schedule proactive token refresh before expiry
  const scheduleTokenRefresh = useCallback(
    (accessToken: string) => {
      clearRefreshTimer();
      const payload = decodeJwt(accessToken);
      if (!payload.exp) return;

      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      // Refresh 60 seconds before expiry
      const refreshIn = Math.max(expiresAt - now - 60000, 5000);

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const { access_token } = await api.auth.refresh();
          localStorage.setItem("dravio_access_token", access_token);
          setToken(access_token);
          scheduleTokenRefresh(access_token);
        } catch {
          // Refresh failed — session expired
          handleLogout();
        }
      }, refreshIn);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Handle forced logout (expired session, auth errors)
  const handleLogout = useCallback(() => {
    clearRefreshTimer();
    localStorage.removeItem("dravio_access_token");
    localStorage.removeItem("dravio_user");
    setToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent("dravio:logged_out"));
  }, [clearRefreshTimer]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("dravio_access_token");
      const storedUser = localStorage.getItem("dravio_user");

      if (storedToken && storedUser) {
        // Validate token hasn't expired
        const payload = decodeJwt(storedToken);
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token expired — clear and don't restore
          localStorage.removeItem("dravio_access_token");
          localStorage.removeItem("dravio_user");
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          scheduleTokenRefresh(storedToken);
        }
      }
    } catch (err) {
      console.warn("[Auth] Failed to restore session:", err);
      localStorage.removeItem("dravio_access_token");
      localStorage.removeItem("dravio_user");
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh]);

  // Listen for auth_expired events from API client
  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };

    const handleTokenRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.token) {
        setToken(detail.token);
        scheduleTokenRefresh(detail.token);
      }
    };

    window.addEventListener("dravio:auth_expired", handleAuthExpired);
    window.addEventListener("dravio:token_refreshed", handleTokenRefreshed);
    return () => {
      window.removeEventListener("dravio:auth_expired", handleAuthExpired);
      window.removeEventListener("dravio:token_refreshed", handleTokenRefreshed);
    };
  }, [handleLogout, scheduleTokenRefresh]);

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
          // Profile fetch failed — token may be expired, handled by API client
        });
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (email: string, password: string) => {
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
        // Profile might not exist yet — not a fatal error
      }

      localStorage.setItem("dravio_user", JSON.stringify(newUser));
      setUser(newUser);
      scheduleTokenRefresh(access_token);

      // Notify socket system to connect
      window.dispatchEvent(
        new CustomEvent("dravio:authenticated", { detail: { token: access_token, user: newUser } })
      );
    },
    [scheduleTokenRefresh]
  );

  const register = useCallback(
    async (email: string, password: string, full_name: string) => {
      await api.auth.register(email, password, full_name);
      // Auto-login after registration
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

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

  const oauthLogin = useCallback(
    async (provider: string, tokens: { id_token?: string; access_token?: string }, role?: string) => {
      const { access_token } = await api.auth.oauthLogin(provider, tokens, role);
      
      localStorage.setItem("dravio_access_token", access_token);
      setToken(access_token);

      const payload = decodeJwt(access_token);
      const newUser: User = {
        id: payload.sub,
        email: "", // Fetched below
        role: (payload.roles?.[0] as User["role"]) || "buyer",
      };

      try {
        const { profile } = await api.user.getProfile();
        newUser.profile = profile;
      } catch {}

      localStorage.setItem("dravio_user", JSON.stringify(newUser));
      setUser(newUser);
      scheduleTokenRefresh(access_token);

      window.dispatchEvent(
        new CustomEvent("dravio:authenticated", { detail: { token: access_token, user: newUser } })
      );
    },
    [scheduleTokenRefresh]
  );

  const sendOtp = useCallback(async (phone_number: string) => {
    await api.auth.sendOtp(phone_number);
  }, []);

  const verifyOtp = useCallback(
    async (phone_number: string, code: string, role?: string) => {
      const { access_token } = await api.auth.verifyOtp(phone_number, code, role);
      
      localStorage.setItem("dravio_access_token", access_token);
      setToken(access_token);

      const payload = decodeJwt(access_token);
      const newUser: User = {
        id: payload.sub,
        email: "", 
        role: (payload.roles?.[0] as User["role"]) || "buyer",
      };

      try {
        const { profile } = await api.user.getProfile();
        newUser.profile = profile;
      } catch {}

      localStorage.setItem("dravio_user", JSON.stringify(newUser));
      setUser(newUser);
      scheduleTokenRefresh(access_token);

      window.dispatchEvent(
        new CustomEvent("dravio:authenticated", { detail: { token: access_token, user: newUser } })
      );
    },
    [scheduleTokenRefresh]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => clearRefreshTimer();
  }, [clearRefreshTimer]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, refreshProfile, oauthLogin, sendOtp, verifyOtp }}
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
