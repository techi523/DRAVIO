/**
 * Web/Expo Go safe mock for react-native-wireguard-vpn.
 * The real native module is only available in custom development builds.
 * This mock prevents Metro from crashing when bundling for web or Expo Go.
 */
const WireguardMock = {
  initialize: async () => {
    if (!__DEV__) {
      throw new Error('[DRAVIO FATAL] WireGuard mock invoked in a PRODUCTION build. Native module missing.');
    }
    console.warn('[WireGuard Mock] initialize() called - native module not available in Expo Go/Web.');
  },
  connect: async (config) => {
    if (!__DEV__) {
      throw new Error('[DRAVIO FATAL] WireGuard mock invoked in a PRODUCTION build. Native module missing.');
    }
    console.warn('[WireGuard Mock] connect() called with server:', config?.serverAddress);
    return true; // Simulate success in dev
  },
  disconnect: async () => {
    if (!__DEV__) {
      throw new Error('[DRAVIO FATAL] WireGuard mock invoked in a PRODUCTION build. Native module missing.');
    }
    console.warn('[WireGuard Mock] disconnect() called.');
  },
  getStatus: async () => {
    if (!__DEV__) {
      return { status: 'disconnected' };
    }
    return { status: 'disconnected' };
  },
};

export default WireguardMock;
