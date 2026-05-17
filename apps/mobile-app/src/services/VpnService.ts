import { api } from './api';

export interface VpnStats {
  bytesIn: number;
  bytesOut: number;
  latency: number;
  uptime: number;
  status: 'connected' | 'disconnected' | 'connecting';
}

class VpnService {
  private intervalId: NodeJS.Timeout | null = null;
  private stats: VpnStats = {
    bytesIn: 0,
    bytesOut: 0,
    latency: 0,
    uptime: 0,
    status: 'disconnected',
  };
  private sessionId: string | null = null;
  private listeners: ((stats: VpnStats) => void)[] = [];

  async connect(sessionId: string, config: any): Promise<boolean> {
    console.log(`Connecting to session ${sessionId} with config:`, config);
    this.stats.status = 'connecting';
    this.notifyListeners();

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    this.sessionId = sessionId;
    this.stats.status = 'connected';
    this.stats.uptime = 0;
    this.stats.bytesIn = 0;
    this.stats.bytesOut = 0;
    this.stats.latency = 15 + Math.random() * 20;
    
    this.startTracking();
    this.notifyListeners();
    return true;
  }

  async disconnect(): Promise<void> {
    this.stopTracking();
    this.stats.status = 'disconnected';
    this.sessionId = null;
    this.notifyListeners();
  }

  private startTracking() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      if (this.stats.status === 'connected') {
        this.stats.uptime += 1;
        // Simulate traffic: 1-5MB per second
        const download = Math.random() * 5 * 1024 * 1024;
        const upload = Math.random() * 0.5 * 1024 * 1024;
        
        this.stats.bytesIn += download;
        this.stats.bytesOut += upload;
        this.stats.latency = 10 + Math.random() * 30;

        this.reportUsage(download + upload);
        this.notifyListeners();
      }
    }, 1000);
  }

  private stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async reportUsage(bytes: number) {
    if (!this.sessionId) return;
    
    try {
      // Convert to MB for the billing service
      const mb = bytes / (1024 * 1024);
      await api.post('/billing/usage', {
        sessionId: this.sessionId,
        dataUsedMb: mb,
      });
    } catch (error) {
      console.error('Failed to report usage:', error);
    }
  }

  onStatsUpdate(callback: (stats: VpnStats) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l({ ...this.stats }));
  }

  getStats() {
    return { ...this.stats };
  }
}

export const vpnService = new VpnService();
