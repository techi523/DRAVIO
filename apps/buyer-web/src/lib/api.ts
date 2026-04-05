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
    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/sellers`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch sellers');
      const data = await response.json();
      // Handle unified response format { status: 'success', data: { results: [...] } }
      return data.data.results.map((s: any) => ({
        id: s.id,
        name: s.name || `Alpha Relay #${s.id.slice(0, 2)}`,
        location: s.location || 'Nairobi, KE',
        latency: s.latency || '15ms',
        price_per_gb: s.price_per_gb || 0.50,
        uptime: '99.9%'
      }));
    } catch (error) {
      console.error('API Error (getSellers):', error);
      return [];
    }
  },

  async getWalletBalance(): Promise<WalletBalance> {
    try {
      const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch balance');
      const data = await response.json();
      return {
        balance: data.data.balance,
        currency: data.data.currency
      };
    } catch (error) {
      console.error('API Error (getWalletBalance):', error);
      return { balance: 0.00, currency: 'USD' };
    }
  }
};
