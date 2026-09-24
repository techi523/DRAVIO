/**
 * DRAVIO Admin Portal — Production API Client
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || (process.env.NODE_ENV === 'production' ? 'https://api.dravio.com' : 'http://localhost:8080');

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

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dravio_admin_token');
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('dravio_admin_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
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

    if (response.status === 204) {
      return {} as T;
    }

    const json = await response.json();

    if (!response.ok) {
      if (response.status === 401 && endpoint !== '/v1/auth/login') {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new ApiError(
        response.status,
        json.error?.message || json.message || `HTTP_${response.status}`,
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
    throw error;
  }
}

export const api = {
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

  auth: {
    login: (email: string, password: string) =>
      request<any>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    oauthLogin: (provider: string, tokens: { id_token?: string; access_token?: string }, role_preference: string = 'ADMIN') =>
      request<any>('/v1/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({ provider, ...tokens, role_preference }),
      }),
  },
  admin: {
    getTelemetry: () => request<any>('/v1/admin/telemetry'),
    getIncidents: () => request<any>('/v1/admin/incidents'),
  }
};
