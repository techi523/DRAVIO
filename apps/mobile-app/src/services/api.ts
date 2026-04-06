import * as SecureStore from 'expo-secure-store';

let API_BASE_URL = 'http://192.168.1.118:8080/v1'; // Default, should be updated dynamically

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}

export const setBaseUrl = (url: string) => {
  API_BASE_URL = url;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync('dravio_token');
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      // Handle session expiration
      if (response.status === 401) {
        await SecureStore.deleteItemAsync('dravio_token');
        // Trigger logout or redirect in UI if needed
      }
      throw new Error(json.error || json.message || 'API_ERROR');
    }

    return json.data || json; // Support both wrapped and unwrapped responses
  } catch (error: any) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => 
    request<T>(endpoint, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  put: <T>(endpoint: string, body?: any) => 
    request<T>(endpoint, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
