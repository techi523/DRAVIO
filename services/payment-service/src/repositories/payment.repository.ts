import { pool } from '../db/client.js';

export interface Transaction {
  id: string;
  session_id: string;
  user_id: string;
  amount_usd: number;
  currency: string;
  payment_method: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  provider_ref?: string;
  idempotency_key?: string;
  created_at: Date;
}

export class PaymentRepository {
  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE idempotency_key = $1',
      [key]
    );
    return result.rows[0] || null;
  }

  async create(input: any): Promise<Transaction> {
    const result = await pool.query(
      'INSERT INTO payments.transactions (session_id, user_id, amount_usd, currency, payment_method, status, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [input.session_id, input.user_id, input.amount_usd, input.currency, input.method, 'PENDING', input.idempotency_key]
    );
    return result.rows[0];
  }

  async updateProviderRef(id: string, ref: string): Promise<void> {
    await pool.query('UPDATE payments.transactions SET provider_ref = $1 WHERE id = $2', [ref, id]);
  }

  async completeByRef(ref: string): Promise<Transaction | null> {
    const result = await pool.query(
      'UPDATE payments.transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE provider_ref = $2 RETURNING *',
      ['COMPLETED', ref]
    );
    return result.rows[0] || null;
  }
}

export const paymentRepository = new PaymentRepository();
