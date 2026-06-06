import { NativeModules, Platform, DeviceEventEmitter } from 'react-native';
import io, { type Socket } from 'socket.io-client';
import { storage } from './storage';

const resolveWsUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_WS_URL;
  if (envUrl) return envUrl;

  if (__DEV__ && Platform.OS !== 'web') {
    const scriptURL = NativeModules.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^(https?):\/\/([^/:]+)/);
    if (match?.[1] && match?.[2]) {
      const host = match[2];
      return `http://${host}:8080`;
    }
  }

  if (__DEV__) return 'http://localhost:8080';

  // Throws if the URL is not provided in env and we're not in dev mode
  throw new Error('[DRAVIO] EXPO_PUBLIC_WS_URL is not configured.');
};

const WS_URL = resolveWsUrl();

let socket: Socket | null = null;
let socketPromise: Promise<Socket> | null = null;

export const getSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;
  if (socket) return socket; // Return connecting socket
  if (socketPromise) return socketPromise;

  socketPromise = (async () => {
    const token = await storage.getItem('dravio_token');

    socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[DRAVIO] WebSocket connected');
      DeviceEventEmitter.emit('dravio:socket_connected');
    });

    socket.on('connect_error', async (error: any) => {
      if (__DEV__) console.warn('[DRAVIO] Socket error:', error.message);
      // Auto-reconnect with fresh token if auth failed or polling dropped
      if (error.message.includes('401') || error.message.includes('Authentication') || error.message === 'xhr poll error') {
         const latestToken = await storage.getItem('dravio_token');
         if (latestToken && socket) {
            socket.auth = { token: latestToken };
            socket.connect();
         }
      }
    });

    socket.on('disconnect', (reason: any) => {
      if (__DEV__) console.log('[DRAVIO] Socket disconnected:', reason);
    });

    socketPromise = null;
    return socket;
  })();

  return socketPromise;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const onEvent = async (event: string, callback: (data: any) => void) => {
  const s = await getSocket();
  s.on(event, callback);
  return () => s.off(event, callback);
};

export const subscribeToEarnings = (callback: (data: { total: number }) => void) =>
  onEvent('earnings_update', callback);

export const subscribeToBillingAlerts = (callback: (data: { type: string; message: string }) => void) =>
  onEvent('billing_alert', callback);

export const subscribeToPeerUpdates = (callback: (data: any) => void) =>
  onEvent('peer_update', callback);
