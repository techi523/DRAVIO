// Metro resolver redirects this to src/mocks/wireguard-mock.js in Expo Go / Web builds.
// In custom native builds, this resolves to the real react-native-wireguard-vpn package.
import Wireguard from 'react-native-wireguard-vpn';

export interface VpnConfig {
  privateKey: string;
  publicKey: string;
  endpoint: string; // "host:port"
  dns?: string;
  allowedIPs: string;
  address: string;
}

let isInitialized = false;

export const VpnManager = {
  /**
   * Connect to VPN using a WireGuard config string OR a config object
   */
  connect: async (configOrString: string | VpnConfig): Promise<boolean> => {
    try {
      console.log('VpnManager: Initiating VPN connection...');
      
      if (!isInitialized) {
        await Wireguard.initialize();
        isInitialized = true;
      }

      let config: VpnConfig;

      if (typeof configOrString === 'string') {
        config = parseWgConfig(configOrString);
      } else {
        config = configOrString;
      }

      // Parse endpoint into host and port
      const [serverAddress, portStr] = config.endpoint.split(':');
      const serverPort = parseInt(portStr || '51820', 10);

      // Using the correct API: connect(config: WireGuardConfig)
      await Wireguard.connect({
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        serverAddress: serverAddress,
        serverPort: serverPort,
        address: config.address,
        dns: config.dns ? config.dns.split(',').map(s => s.trim()) : ['1.1.1.1'],
        allowedIPs: config.allowedIPs.split(',').map(s => s.trim()),
      });

      console.log('VpnManager: Connected.');
      return true;
    } catch (error: any) {
      console.error('VpnManager: Connection failed:', error);
      throw error;
    }
  },

  disconnect: async (): Promise<boolean> => {
    try {
      console.log('VpnManager: Disconnecting...');
      await Wireguard.disconnect();
      return true;
    } catch (error) {
      console.error('VpnManager: Disconnect failed:', error);
      return false;
    }
  },

  getStatus: async (): Promise<{ status: string; bytesIn?: number; bytesOut?: number }> => {
    try {
      const statusObj = await Wireguard.getStatus();
      return {
        status: statusObj.status.toLowerCase(),
        bytesIn: (statusObj as any).tx || 0,
        bytesOut: (statusObj as any).rx || 0
      };
    } catch (error) {
      return { status: 'unknown', bytesIn: 0, bytesOut: 0 };
    }
  }
};

/**
 * Utility to parse standard WireGuard config string into an object
 */
function parseWgConfig(configStr: string): VpnConfig {
  const lines = configStr.split('\n');
  const config: Partial<VpnConfig> = {
    dns: '1.1.1.1',
    allowedIPs: '0.0.0.0/0',
  };

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('[')) return;
    
    const parts = clean.split('=');
    if (parts.length < 2) return;
    
    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join('=').trim();

    if (key === 'privatekey') config.privateKey = value;
    if (key === 'address') config.address = value;
    if (key === 'dns') config.dns = value;
    if (key === 'publickey') config.publicKey = value;
    if (key === 'endpoint') config.endpoint = value;
    if (key === 'allowedips') config.allowedIPs = value;
  });

  return config as VpnConfig;
}
