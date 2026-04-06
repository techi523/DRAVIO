import io, { type Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;
const SOCKET_URL = 'http://192.168.1.118:8080'; // Should match API_BASE_URL

export const getSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('dravio_token');

  socket = io(SOCKET_URL, {
    auth: {
      token: token,
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket Gateway');
  });

  socket.on('connect_error', (error: any) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason: any) => {
    console.log('Disconnected from WebSocket:', reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Event helper
export const onEvent = async (event: string, callback: (data: any) => void) => {
  const s = await getSocket();
  s.on(event, callback);
  return () => s.off(event, callback);
};

// Common events
export const subscribeToEarnings = (callback: (data: { total: number }) => void) => {
  return onEvent('earnings_update', callback);
};

export const subscribeToBillingAlerts = (callback: (data: { type: string, message: string }) => void) => {
  return onEvent('billing_alert', callback);
};
