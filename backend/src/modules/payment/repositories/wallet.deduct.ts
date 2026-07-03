import { pool } from '../db/client.js';

export const walletRepository = {
  async deductBalance(userId: string, amountUsd: number): Promise<{ new_balance: number }> {
    const result = await pool.query(
      `UPDATE billing.wallets
         SET balance_usd = balance_usd - $2,
             updated_at = NOW()
       WHERE customer_id = $1
         AND balance_usd >= $2
       RETURNING balance_usd`,
      [userId, amountUsd]
    );

    if (result.rowCount === 0) {
      const existing = await pool.query(
        'SELECT balance_usd FROM billing.wallets WHERE customer_id = $1',
        [userId]
      );
      if (existing.rowCount === 0) {
        await pool.query(
          'INSERT INTO billing.wallets (customer_id, balance_usd) VALUES ($1, 0) ON CONFLICT DO NOTHING',
          [userId]
        );
        return { new_balance: 0 };
      }
      throw new Error('INSUFFICIENT_BALANCE');
    }

    return { new_balance: parseFloat(result.rows[0].balance_usd) };
  },
};
