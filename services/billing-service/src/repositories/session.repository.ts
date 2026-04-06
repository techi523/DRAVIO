import { pool } from '../db/client.js';

export interface SessionRecord {
  id: string;
  customer_id: string;
  hardware_id: string; // VPN node or Router ID
  session_token: string;
  bytes_used: bigint;
  cost_accumulated: number;
  status: 'ACTIVE' | 'CLOSED' | 'KILLED';
  started_at: Date;
  ended_at: Date | null;
}

export class SessionRepository {
  /**
   * Initializes a new session audit record.
   */
  async createSession(customerId: string, hardwareId: string, sessionToken: string): Promise<SessionRecord> {
    const res = await pool.query(
      `INSERT INTO billing.sessions (customer_id, hardware_id, session_token, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING *`,
      [customerId, hardwareId, sessionToken]
    );
    return res.rows[0];
  }

  /**
   * Updates usage bytes and costs continuously for live sessions.
   */
  async updateSessionUsage(sessionToken: string, bytesUsed: bigint, additionalCost: number): Promise<SessionRecord | null> {
    const res = await pool.query(
      `UPDATE billing.sessions
       SET 
         bytes_used = bytes_used + $1,
         cost_accumulated = cost_accumulated + $2
       WHERE session_token = $3 AND status = 'ACTIVE'
       RETURNING *`,
      [bytesUsed.toString(), additionalCost, sessionToken]
    );
    return res.rows[0] || null;
  }

  /**
   * Finalizes the session lifecycle bounds (END or KILL).
   */
  async endSession(sessionToken: string, status: 'CLOSED' | 'KILLED'): Promise<SessionRecord | null> {
    const res = await pool.query(
      `UPDATE billing.sessions
       SET status = $1, ended_at = CURRENT_TIMESTAMP
       WHERE session_token = $2
       RETURNING *`,
      [status, sessionToken]
    );
    return res.rows[0] || null;
  }

  async getActiveSession(sessionToken: string): Promise<SessionRecord | null> {
    const res = await pool.query(
      `SELECT * FROM billing.sessions WHERE session_token = $1 AND status = 'ACTIVE'`,
      [sessionToken]
    );
    return res.rows[0] || null;
  }
}

export const sessionRepository = new SessionRepository();
