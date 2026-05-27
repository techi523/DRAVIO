/**
 * DRAVIO Buyer Web — Real API Client
 * All requests go through the Gateway at :8080 which proxies to microservices.
 * Modeled after the working mobile-app/src/services/api.ts pattern.
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

// ─── Core Request Function ────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dravio_access_token');
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getToken();

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
    const json = await response.json();

    if (!response.ok) {
      // Automatic Token Refresh Logic
      if (response.status === 401 && !isRetry && endpoint !== '/v1/auth/login' && endpoint !== '/v1/auth/refresh') {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });
            const refreshData = await refreshRes.json();
            
            if (refreshRes.ok && refreshData.data?.access_token) {
              const newToken = refreshData.data.access_token;
              localStorage.setItem('dravio_access_token', newToken);
              onRefreshed(newToken);
              isRefreshing = false;
              
              // Retry with new token
              headers.set('Authorization', `Bearer ${newToken}`);
              const retryRes = await fetch(url, { ...options, headers });
              const retryJson = await retryRes.json();
              if (retryRes.ok) return retryJson.data ?? retryJson;
            }
          } catch (e) {
            // Refresh failed
          }
          isRefreshing = false;
          // If refresh failed, clear token
          if (typeof window !== 'undefined') {
            localStorage.removeItem('dravio_access_token');
            localStorage.removeItem('dravio_user');
            window.location.href = '/login';
          }
        } else {
          // Wait for the active refresh to complete
          return new Promise((resolve, reject) => {
            refreshSubscribers.push(async (newToken: string) => {
              headers.set('Authorization', `Bearer ${newToken}`);
              try {
                const retryRes = await fetch(url, { ...options, headers });
                const retryJson = await retryRes.json();
                if (retryRes.ok) resolve(retryJson.data ?? retryJson);
                else reject(new ApiError(retryRes.status, retryJson.error || 'Retry Failed'));
              } catch (e) {
                reject(e);
              }
            });
          });
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
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
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
      request<Transaction[]>('/v1/wallet/transactions'),
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

    reportUsage: (sessionId: string, dataUsedMb: number) =>
      request<{ success: boolean }>('/v1/billing/usage', {
        method: 'POST',
        body: JSON.stringify({ sessionId, dataUsedMb }),
      }),
  },

  // ── Payments ─────────────────────────────────────────────────
  payments: {
    initiate: (amount: number, currency: string, method: string) =>
      request<any>('/v1/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ amount, currency, payment_method: method }),
      }),
  },
};
