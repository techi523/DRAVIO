export interface User {
  id: string;
  email: string;
  kycLevel: number;
}

export interface Session {
  id: string;
  buyerId: string;
  sellerId: string;
  status: 'active' | 'completed' | 'terminated';
  dataLimitMb: number;
}

export interface PaymentIntent {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
}
