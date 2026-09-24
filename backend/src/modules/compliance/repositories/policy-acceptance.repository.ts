import { pool } from '../../../db/client.js';

export interface PolicyAcceptanceRow {
  id: string;
  user_id: string;
  policy_id: string;
  version: string;
  ip_address: string | null;
  user_agent: string | null;
  accepted_at: Date;
}

export const policyAcceptanceRepository = {
  /** Idempotent — a given (user, policy, version) can only be accepted once. */
  async record(input: {
    userId: string;
    policyId: string;
    version: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<PolicyAcceptanceRow | null> {
    const result = await pool.query(
      `INSERT INTO compliance.policy_acceptances (user_id, policy_id, version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4::inet, $5)
       ON CONFLICT (user_id, policy_id, version) DO NOTHING
       RETURNING *`,
      [input.userId, input.policyId, input.version, input.ip || null, input.userAgent || null]
    );
    return result.rows[0] || null;
  },

  async hasAccepted(userId: string, policyId: string, version: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM compliance.policy_acceptances
        WHERE user_id = $1 AND policy_id = $2 AND version = $3`,
      [userId, policyId, version]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async acceptedVersions(userId: string): Promise<Array<{ policy_id: string; version: string; accepted_at: Date }>> {
    const result = await pool.query(
      `SELECT policy_id, version, accepted_at FROM compliance.policy_acceptances
        WHERE user_id = $1
        ORDER BY accepted_at DESC`,
      [userId]
    );
    return result.rows;
  },
};