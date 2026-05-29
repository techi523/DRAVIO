import { NativeModules, Platform } from 'react-native';
import { storage } from './storage';

/**
 * Resolves the API base URL based on environment.
 *
 * - Production/Preview: uses EXPO_PUBLIC_API_URL env var set by EAS Build
 * - Development (Expo Go / Metro): auto-detects host IP from Metro scriptURL
 *   so physical devices connect to the dev machine on the same Wi-Fi
 */
const resolveApiUrl = (): string => {
  // EAS-injected production/preview URL takes highest priority
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // Dev-only: auto-detect Metro bundler host IP for physical device testing
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // In Android Emulators, 10.0.2.2 points directly to the host computer's localhost
      const scriptURL = NativeModules.SourceCode?.scriptURL || '';
      if (scriptURL.includes('localhost') || scriptURL.includes('127.0.0.1')) {
        return 'http://10.0.2.2:8080/v1';
      }
    }

    if (Platform.OS !== 'web') {
      const scriptURL = NativeModules.SourceCode?.scriptURL || '';
      // Support both IPv4 LAN IPs and ngrok/tunnel domains
      const match = scriptURL.match(/^(https?):\/\/([^/:]+)/);
      if (match?.[1] && match?.[2]) {
        const host = match[2];
        if (host.includes('ngrok') || host.includes('exp.direct')) {
           console.warn('[DRAVIO] Tunnel mode detected. Local backend on port 8080 may be unreachable unless proxied. Consider setting EXPO_PUBLIC_API_URL.');
        }
        return `http://${host}:8080/v1`;
      }
    }
  }

  // Web dev fallback
  if (__DEV__) return 'http://localhost:8080/v1';

  // Should never reach here in a properly configured EAS build
  throw new Error('[DRAVIO] EXPO_PUBLIC_API_URL is not configured. Check eas.json env block.');
};

export const API_BASE_URL = resolveApiUrl();

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const currentToken = await storage.getItem('dravio_token');
  if (!currentToken) return null;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
          'X-Client-Version': process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
          'X-Platform': Platform.OS
        },
      });

      if (!response.ok) {
        await storage.deleteItem('dravio_token');
        await storage.deleteItem('dravio_user');
        return null;
      }

      const json = await response.json();
      const newToken = json.data?.access_token || json.access_token;
      if (newToken) {
        await storage.setItem('dravio_token', newToken);
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = await storage.getItem('dravio_token');

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Client-Version', process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0');
  headers.set('X-Platform', Platform.OS);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } else {
        await storage.deleteItem('dravio_token');
        await storage.deleteItem('dravio_user');
      }
    }

    clearTimeout(timeout);
    
    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || json.message || `HTTP ${response.status}`);
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

const inflightGetRequests = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export const api = {
  get: <T>(endpoint: string, disableCache = false): Promise<T> => {
    const inflight = inflightGetRequests.get(endpoint);
    if (inflight) return inflight;

    const cached = cache.get(endpoint);
    const isStale = !cached || (Date.now() - cached.timestamp > CACHE_TTL);

    if (cached && !disableCache) {
      if (isStale) {
        const bgPromise = request<T>(endpoint, { method: 'GET' })
          .then(data => {
            cache.set(endpoint, { data, timestamp: Date.now() });
            return data;
          })
          .catch(e => {
            if (__DEV__) console.warn('[DRAVIO] Background revalidate failed:', e);
            throw e;
          });
        inflightGetRequests.set(endpoint, bgPromise);
        bgPromise.finally(() => inflightGetRequests.delete(endpoint));
      }
      return Promise.resolve(cached.data as T);
    }
    
    const promise = request<T>(endpoint, { method: 'GET' }).then(data => {
      cache.set(endpoint, { data, timestamp: Date.now() });
      return data;
    });
    inflightGetRequests.set(endpoint, promise);
    promise.finally(() => inflightGetRequests.delete(endpoint));
    return promise;
  },
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
