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
  async findById(id: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Ownership-scoped lookup — prevents IDOR across users.
  async findOwnedById(id: string, userId: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE idempotency_key = $1',
      [key]
    );
    return result.rows[0] || null;
  }

  async findByRef(ref: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE provider_ref = $1',
      [ref]
    );
    return result.rows[0] || null;
  }

  async create(input: any): Promise<Transaction | null> {
    const result = await pool.query(
      `INSERT INTO payments.transactions (session_id, user_id, amount_usd, currency, payment_method, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [input.session_id, input.user_id, input.amount_usd, input.currency, input.method, 'PENDING', input.idempotency_key]
    );
    return result.rows[0] || null;
  }

  async updateProviderRef(id: string, ref: string): Promise<void> {
    await pool.query('UPDATE payments.transactions SET provider_ref = $1 WHERE id = $2', [ref, id]);
  }

  // Transition a transaction to COMPLETED only if it is still PENDING.
  // Never re-flips FAILED/COMPLETED rows; emits true only on a real transition.
  async completeByRef(ref: string): Promise<Transaction | null> {
    const result = await pool.query(
      `UPDATE payments.transactions
          SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE provider_ref = $1 AND status = 'PENDING'
        RETURNING *`,
      [ref]
    );
    return result.rows[0] || null;
  }

  async failByRef(ref: string, reason?: string): Promise<Transaction | null> {
    const result = await pool.query(
      `UPDATE payments.transactions
          SET status = 'FAILED', failure_reason = $2, updated_at = CURRENT_TIMESTAMP
        WHERE provider_ref = $1 AND status = 'PENDING'
        RETURNING *`,
      [ref, reason || null]
    );
    return result.rows[0] || null;
  }

  /**
   * Atomically complete a PENDING transaction AND credit the buyer's wallet
   * (immutable-style ledger append) in a single DB transaction.
   * Returns null when the transaction was not in a PENDING state (dedup/replay).
   */
  async completeAndCredit(
    ref: string,
    fees: { platformFeeUsd: number; sellerNetUsd: number }
  ): Promise<Transaction | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txResult = await client.query(
        `UPDATE payments.transactions
            SET status = 'COMPLETED',
                platform_fee_usd = $2,
                seller_net_usd = $3,
                updated_at = CURRENT_TIMESTAMP
          WHERE provider_ref = $1 AND status = 'PENDING'
          RETURNING *`,
        [ref, fees.platformFeeUsd, fees.sellerNetUsd]
      );

      const transaction = txResult.rows[0] || null;
      if (transaction) {
        // Credit buyer wallet (top-up proceeds from a verified payment).
        await client.query(
          `INSERT INTO billing.wallets (customer_id, balance_usd)
           VALUES ($1, $2)
           ON CONFLICT (customer_id) DO UPDATE
              SET balance_usd = billing.wallets.balance_usd + $2,
                  updated_at = CURRENT_TIMESTAMP`,
          [transaction.user_id, transaction.amount_usd]
        );
        // Immutable ledger entry for auditability.
        await client.query(
          `INSERT INTO billing.ledger_entries
             (user_id, amount_usd, transaction_type, reference, status, metadata)
           VALUES ($1, $2, 'wallet_credit', $3, 'COMPLETED', $4)`,
          [
            transaction.user_id,
            transaction.amount_usd,
            transaction.id,
            JSON.stringify({ provider_ref: ref, platform_fee_usd: fees.platformFeeUsd }),
          ]
        );
      }

      await client.query('COMMIT');
      return transaction;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const paymentRepository = new PaymentRepository();