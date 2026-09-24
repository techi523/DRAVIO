import { pool } from '../../../db/client.js';

export interface PrivacyRequestRow {
  id: string;
  requester_id: string;
  right_type: string;
  status: string;
  request_payload: Record<string, unknown>;
  outcome: Record<string, unknown> | null;
  reviewed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export const privacyRequestRepository = {
  async create(requesterId: string, rightType: string, payload: Record<string, unknown>): Promise<PrivacyRequestRow | null> {
    const result = await pool.query(
      `INSERT INTO compliance.privacy_requests (requester_id, right_type, request_payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [requesterId, rightType, JSON.stringify(payload)]
    );
    return result.rows[0] || null;
  },

  async listOwn(userId: string): Promise<PrivacyRequestRow[]> {
    const result = await pool.query(
      `SELECT * FROM compliance.privacy_requests
        WHERE requester_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async findOwnedById(id: string, requesterId: string): Promise<PrivacyRequestRow | null> {
    const result = await pool.query(
      `SELECT * FROM compliance.privacy_requests WHERE id = $1 AND requester_id = $2`,
      [id, requesterId]
    );
    return result.rows[0] || null;
  },

  /** Reviewer-scoped lookup (any requester). Only the review route uses this. */
  async findById(id: string): Promise<PrivacyRequestRow | null> {
    const result = await pool.query(
      `SELECT * FROM compliance.privacy_requests WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /** CAS-guarded state transition; returns null when the request was not in
   *  `fromStatus` (concurrent update lost). */
  async transition(
    id: string,
    fromStatus: string,
    toStatus: string,
    reviewedBy: string | null,
    outcome?: Record<string, unknown> | null
  ): Promise<PrivacyRequestRow | null> {
    const result = await pool.query(
      `UPDATE compliance.privacy_requests
          SET status = $3,
              reviewed_by = COALESCE($4, reviewed_by),
              outcome = COALESCE($5, outcome),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = $2
        RETURNING *`,
      [id, fromStatus, toStatus, reviewedBy, outcome ? JSON.stringify(outcome) : null]
    );
    return result.rows[0] || null;
  },
};