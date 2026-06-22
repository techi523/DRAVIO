/**
 * DRAVIO Buyer Web — Production API Client
 * All requests go through the Gateway at :8080 which proxies to microservices.
 * Features: JWT auth, automatic token refresh, request deduplication, timeout, error handling.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ─── Types ─────────────────────────────────────────────────────────

export interface Seller {
  id: string;
  name?: string;
  distance: number;
  unit: string;
  pricing_model: string;
  price_per_gb: number;
  avg_speed: number;
  stability: number;
  status: string;
  last_seen: number;
}

export interface WalletBalance {
  balance_usd: number;
  escrow_usd?: number;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
  status?: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  isp_id: string;
  amount_usd: number;
  currency: string;
  status: string;
  due_date: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  kyc_level: number;
  country_code: string;
  phone_number: string;
  is_seller: boolean;
}

export interface AuthResponse {
  access_token: string;
}

export interface RegisterResponse {
  userId: string;
}

export interface SessionStartResponse {
  sessionToken: string;
  vpn_config?: string;
}

export interface ActiveSession {
  id: string;
  customer_id: string;
  hardware_id: string;
  session_token: string;
  bytes_used: string;
  cost_accumulated: string;
  status: 'ACTIVE' | 'CLOSED' | 'KILLED';
  started_at: string;
  ended_at: string | null;
}

export interface PaymentInitResponse {
  payment_id: string;
  provider_ref: string;
  provider_type: string;
  status: string;
  checkout_url?: string;
}

export interface PaymentStatus {
  payment_id: string;
  status: string;
  amount_usd: number;
  provider_ref: string;
}

// ─── Error Class ───────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

// ─── Token Management ─────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dravio_access_token');
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dravio_access_token', token);
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('dravio_access_token');
  localStorage.removeItem('dravio_user');
}

/** Decode JWT payload to check expiration */
function getTokenExpiry(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.exp ? payload.exp * 1000 : null; // Convert to ms
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, bufferMs = 30000): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false; // No expiry claim — treat as valid
  return Date.now() >= expiry - bufferMs;
}

// ─── Token Refresh Logic ──────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, return the same promise to avoid duplicate calls
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const currentToken = getToken();
  if (!currentToken) return null;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        // Refresh failed — token is truly expired
        clearAuth();
        return null;
      }

      const json = await response.json();
      const newToken = json.data?.access_token || json.access_token;
      if (newToken) {
        setToken(newToken);
        // Notify auth context of token refresh
        window.dispatchEvent(new CustomEvent('dravio:token_refreshed', { detail: { token: newToken } }));
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Request Deduplication ────────────────────────────────────────

const inflightRequests = new Map<string, Promise<any>>();

function getDedupeKey(endpoint: string, method: string): string {
  return `${method}:${endpoint}`;
}

// ─── Core Request Function ────────────────────────────────────────

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000;

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  config: { dedupe?: boolean; retries?: number; disableCache?: boolean } = {}
): Promise<T> {
  const method = options.method || 'GET';
  
  // Deduplication & Caching for GET requests
  if (method === 'GET') {
    const key = getDedupeKey(endpoint, method);
    
    if (config.dedupe !== false) {
      const inflight = inflightRequests.get(key);
      if (inflight) return inflight;
    }

    const cached = cache.get(key);
    const isStale = !cached || (Date.now() - cached.timestamp > CACHE_TTL);

    if (cached && !config.disableCache) {
      if (isStale) {
        // SWR: Fetch in background
        const bgPromise = executeRequest<T>(endpoint, options, config.retries)
          .then(data => {
            cache.set(key, { data, timestamp: Date.now() });
            return data;
          }).catch(e => console.warn('[DRAVIO] Background revalidate failed:', e));
        
        if (config.dedupe !== false) {
          inflightRequests.set(key, bgPromise);
          bgPromise.finally(() => inflightRequests.delete(key));
        }
      }
      return Promise.resolve(cached.data as T);
    }
    
    const promise = executeRequest<T>(endpoint, options, config.retries).then(data => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    });
    
    if (config.dedupe !== false) {
      inflightRequests.set(key, promise);
      promise.finally(() => inflightRequests.delete(key));
    }
    
    return promise;
  }

  return executeRequest<T>(endpoint, options, config.retries);
}

async function executeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = 0
): Promise<T> {
  let token = getToken();

  // Proactive token refresh if expiring soon
  if (token && isTokenExpired(token) && endpoint !== '/v1/auth/login' && endpoint !== '/v1/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed;
    } else {
      // Force re-login
      clearAuth();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dravio:auth_expired'));
      }
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }
  }

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    const json = await response.json();

    if (!response.ok) {
      // Handle 401 — attempt token refresh and retry once
      if (
        response.status === 401 &&
        endpoint !== '/v1/auth/login' &&
        endpoint !== '/v1/auth/refresh'
      ) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          headers.set('Authorization', `Bearer ${refreshed}`);
          const retryRes = await fetch(url, { ...options, headers });
          const retryJson = await retryRes.json();
          if (retryRes.ok) return retryJson.data ?? retryJson;
        }

        // Refresh failed — force re-login
        clearAuth();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dravio:auth_expired'));
        }
      }

      throw new ApiError(
        response.status,
        json.error || json.message || `HTTP_${response.status}`,
        json.details
      );
    }

    return json.data ?? json;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError(0, 'REQUEST_TIMEOUT', 'Request timed out. Please check your connection.');
    }
    // Retry on network errors
    if (retries > 0 && error.name !== 'AbortError') {
      await new Promise((r) => setTimeout(r, 1000));
      return executeRequest<T>(endpoint, options, retries - 1);
    }
    throw error;
  }
}

// ─── API Methods ──────────────────────────────────────────────────

export const api = {
  // Generic HTTP methods
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  // ── Auth ─────────────────────────────────────────────────────
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (email: string, password: string, full_name: string) =>
      request<RegisterResponse>('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name }),
      }),

    refresh: () =>
      request<AuthResponse>('/v1/auth/refresh', { method: 'POST' }),

    oauthLogin: (provider: string, tokens: { id_token?: string; access_token?: string }, role_preference: string = 'BUYER') =>
      request<AuthResponse>('/v1/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({ provider, ...tokens, role_preference }),
      }),

    sendOtp: (phone_number: string) =>
      request<{ message: string }>('/v1/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone_number }),
      }),

    verifyOtp: (phone_number: string, code: string, role_preference: string = 'BUYER') =>
      request<AuthResponse>('/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone_number, code, role_preference }),
      }),
  },

  // ── User ─────────────────────────────────────────────────────
  user: {
    getProfile: () => request<{ profile: UserProfile }>('/v1/users/me'),
  },

  // ── Marketplace ──────────────────────────────────────────────
  marketplace: {
    getSellers: () =>
      request<{ results: Seller[] }>('/v1/marketplace/sellers'),

    searchSellers: (lat: number, lon: number, radius = 10000) =>
      request<{ results: Seller[] }>(
        `/v1/marketplace/search?lat=${lat}&lon=${lon}&radius=${radius}&unit=km`
      ),

    getSeller: (id: string) => request<Seller>(`/v1/marketplace/sellers/${id}`),
  },

  // ── Wallet / Billing ─────────────────────────────────────────
  wallet: {
    getBalance: () => request<WalletBalance>('/v1/billing/balance'),

    topup: (amount_usd: number) =>
      request<{ success: boolean; new_balance_usd: number }>(
        '/v1/billing/topup',
        { method: 'POST', body: JSON.stringify({ amount_usd }) }
      ),

    getInvoices: () =>
      request<{ invoices: Invoice[] }>('/v1/billing/invoices'),

    getTransactions: () =>
      request<Transaction[]>('/v1/billing/transactions'),
  },

  // ── Sessions / Billing ───────────────────────────────────────
  sessions: {
    start: (hardwareId: string, pricePerMb: number, sellerId: string) =>
      request<SessionStartResponse>('/v1/billing/sessions/start', {
        method: 'POST',
        body: JSON.stringify({ hardwareId, pricePerMb, sellerId }),
      }),

    end: (sessionToken: string) =>
      request<{ success: boolean }>('/v1/billing/sessions/end', {
        method: 'POST',
        body: JSON.stringify({ sessionToken }),
      }),

    getActive: () =>
      request<{ sessions: ActiveSession[] }>('/v1/billing/sessions/active'),

    getHistory: () =>
      request<{ sessions: ActiveSession[] }>('/v1/billing/sessions/history'),

    reportUsage: (sessionId: string, dataUsedMb: number) =>
      request<{ success: boolean }>('/v1/billing/usage', {
        method: 'POST',
        body: JSON.stringify({ sessionId, dataUsedMb }),
      }),
  },

  // ── Payments ─────────────────────────────────────────────────
  payments: {
    initiate: (amount_usd: number, currency: string, method: string, phone_number?: string) =>
      request<PaymentInitResponse>('/v1/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          amount_usd,
          currency,
          method,
          phone_number,
          idempotency_key: crypto.randomUUID(),
        }),
      }),

    getStatus: (paymentId: string) =>
      request<PaymentStatus>(`/v1/payments/${paymentId}/status`),
  },
};
