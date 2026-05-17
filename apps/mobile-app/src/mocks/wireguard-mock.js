/**
 * Web/Expo Go safe mock for react-native-wireguard-vpn.
 * The real native module is only available in custom development builds.
 * This mock prevents Metro from crashing when bundling for web or Expo Go.
 */
const WireguardMock = {
  initialize: async () => {
    console.log('[WireGuard Mock] initialize() called - native module not available in Expo Go/Web.');
  },
  connect: async (config) => {
    console.log('[WireGuard Mock] connect() called with server:', config?.serverAddress);
  },
  disconnect: async () => {
    console.log('[WireGuard Mock] disconnect() called.');
  },
  getStatus: async () => {
    return { status: 'disconnected' };
  },
};

export default WireguardMock;
