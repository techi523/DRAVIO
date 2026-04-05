const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface Seller {
  id: string;
  name: string;
  location: string;
  latency: string;
  price_per_gb: number;
  uptime: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
}

export const api = {
  async getSellers(): Promise<Seller[]> {
    return [
      { id: '1', name: "Z-Link HighSpeed", location: "Kilimani, KE", latency: "12ms", price_per_gb: 10.00, uptime: "99.9%" },
      { id: '2', name: "G-Fiber Node 4", location: "Westlands, KE", latency: "15ms", price_per_gb: 12.50, uptime: "98.5%" },
      { id: '3', name: "Safaricom 5G Share", location: "CBD, KE", latency: "8ms", price_per_gb: 15.00, uptime: "100%" }
    ];
  },

  async getWalletBalance(): Promise<WalletBalance> {
    return { balance: 1250.50, currency: 'KES' };
  }
};
