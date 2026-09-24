import { pool } from '../db/client.js';

export interface TransitionApply {
  transactionId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string | null;
  actorRole: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * CAS-guarded transaction state transition, durably appended to the immutable
 * compliance.transaction_events audit trail within the SAME DB transaction.
 * Returns null when the row was not in `fromStatus` (lost/replayed update).
 */
export const transactionStateRepository = {
  async applyTransition(input: TransitionApply): Promise<{ id: string; status: string } | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txResult = await client.query(
        `UPDATE payments.transactions
            SET status = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND status = $2
          RETURNING id, status`,
        [input.transactionId, input.fromStatus, input.toStatus]
      );
      const updated = txResult.rows[0] || null;

      if (updated) {
        await client.query(
          `INSERT INTO compliance.transaction_events
             (transaction_id, from_status, to_status, actor_id, actor_role, reason, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.transactionId,
            input.fromStatus,
            input.toStatus,
            input.actorId || null,
            input.actorRole || null,
            input.reason || null,
            JSON.stringify(input.metadata || {}),
          ]
        );
      }

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async eventHistory(transactionId: string): Promise<Array<Record<string, unknown>>> {
    const result = await pool.query(
      `SELECT from_status, to_status, actor_id, actor_role, reason, metadata, created_at
        FROM compliance.transaction_events
       WHERE transaction_id = $1
       ORDER BY created_at ASC`,
      [transactionId]
    );
    return result.rows;
  },
};