import { pool } from '../../../db/client.js';

export interface ProviderIntakeRow {
  id: string;
  user_id: string;
  provider_type: string;
  verification: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export const providerIntakeRepository = {
  async create(
    userId: string,
    providerType: string,
    verification: Record<string, unknown>
  ): Promise<ProviderIntakeRow | null> {
    const result = await pool.query(
      `INSERT INTO compliance.provider_intake (user_id, provider_type, verification)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, providerType, JSON.stringify(verification)]
    );
    return result.rows[0] || null;
  },

  async listOwn(userId: string): Promise<ProviderIntakeRow[]> {
    const result = await pool.query(
      `SELECT * FROM compliance.provider_intake
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async latestOwned(userId: string): Promise<ProviderIntakeRow | null> {
    const result = await pool.query(
      `SELECT * FROM compliance.provider_intake
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  /** CAS transition (SUBMITTED → APPROVED / REJECTED / WITHDRAWN). */
  async transition(
    id: string,
    fromStatus: string,
    toStatus: string,
    reviewedBy?: string,
    rejectionReason?: string
  ): Promise<ProviderIntakeRow | null> {
    const result = await pool.query(
      `UPDATE compliance.provider_intake
          SET status = $3,
              rejection_reason = $4,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = $2
        RETURNING *`,
      [id, fromStatus, toStatus, rejectionReason || null]
    );
    return result.rows[0] || null;
  },
};