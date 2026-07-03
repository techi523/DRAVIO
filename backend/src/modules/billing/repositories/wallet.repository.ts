import { pool } from '../db/client.js';

export class WalletRepository {
  async getBalance(userId: string): Promise<{ balance_usd: number; escrow_usd: number }> {
    const res = await pool.query(
      'SELECT balance_usd, escrow_usd FROM billing.wallets WHERE customer_id = $1',
      [userId]
    );
    if (res.rows.length === 0) {
      return { balance_usd: 0, escrow_usd: 0 };
    }
    return {
      balance_usd: parseFloat(res.rows[0].balance_usd),
      escrow_usd: parseFloat(res.rows[0].escrow_usd || '0'),
    };
  }

  async lockEscrow(userId: string, amount: number): Promise<boolean> {
    const res = await pool.query(
      `UPDATE billing.wallets 
       SET escrow_usd = escrow_usd + $1 
       WHERE customer_id = $2 AND (balance_usd - escrow_usd - $1) >= 0
       RETURNING balance_usd, escrow_usd`,
      [amount, userId]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  async commitSessionCost(userId: string, totalCost: number, escrowRelease: number): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const res = await client.query(
        `UPDATE billing.wallets 
         SET 
           balance_usd = balance_usd - $1,
           escrow_usd = escrow_usd - $2
         WHERE customer_id = $3 AND (balance_usd - $1) >= 0
         RETURNING balance_usd`,
        [totalCost, escrowRelease, userId]
      );

      if(res.rowCount === 0) {
        throw new Error("Financial Overdraw Detected or Insufficient Funds to Commit");
      }
      
      await client.query('COMMIT');
      return parseFloat(res.rows[0].balance_usd);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async directDeduct(userId: string, amount: number): Promise<number> {
    const res = await pool.query(
      `UPDATE billing.wallets 
       SET balance_usd = balance_usd - $1 
       WHERE customer_id = $2 AND (balance_usd - $1) >= 0
       RETURNING balance_usd`,
      [amount, userId]
    );
    if (res.rowCount === 0) throw new Error("INSUFFICIENT_FUNDS");
    return parseFloat(res.rows[0].balance_usd);
  }

  async topup(userId: string, amount: number): Promise<number> {
    const res = await pool.query(
      `UPDATE billing.wallets 
       SET balance_usd = balance_usd + $1 
       WHERE customer_id = $2
       RETURNING balance_usd`,
      [amount, userId]
    );
    return parseFloat(res.rows[0].balance_usd);
  }
}

export const walletRepository = new WalletRepository();
