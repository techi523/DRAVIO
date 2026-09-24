import { pool } from '../../../db/client.js';
import { emitAudit } from '../../audit/producer.js';
import { deletionOutcomePlan } from '../../compliance/pure/privacy-rights.js';

/**
 * Data-subject rights fulfillment against the REAL tables.
 * ACCESS/PORTABILITY: an envelope of the user's own data (never includes
 * password hashes or refresh-token material).
 * DELETION: executes the real erasure + pseudonymization plan defined by the
 * pure deletionOutcomePlan (financial records are retained with personal
 * linkage broken by removing the identity rows).
 */
export const privacyService = {
  async collectAccessEnvelope(userId: string): Promise<Record<string, unknown>> {
    const envelope: Record<string, unknown> = {
      requested_at: new Date().toISOString(),
      data_subject: userId,
    };

    const profile = await pool.query(
      `SELECT email, full_name, kyc_level, country_code, phone_number, is_seller
         FROM users.profiles WHERE auth_user_id = $1`,
      [userId]
    );
    envelope.profile = profile.rows[0] || null;

    const providers = await pool.query(
      `SELECT provider_name, provider_email, created_at
         FROM auth.providers WHERE user_id = $1`,
      [userId]
    );
    envelope.linked_identity_providers = providers.rows;

    const transactions = await pool.query(
      `SELECT id, amount_usd, platform_fee_usd, seller_net_usd, currency,
              payment_method, status, created_at, updated_at
         FROM payments.transactions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    envelope.transactions = transactions.rows;

    const sessions = await pool.query(
      `SELECT id, status, bytes_used, cost_accumulated, started_at, ended_at
         FROM billing.sessions WHERE customer_id = $1 ORDER BY started_at DESC`,
      [userId]
    );
    envelope.billing_sessions = sessions.rows;

    const wallet = await pool.query(
      `SELECT id, balance_usd, escrow_usd FROM billing.wallets WHERE customer_id = $1`,
      [userId]
    );
    envelope.wallet = wallet.rows[0] || null;

    const ledger = await pool.query(
      `SELECT amount_usd, transaction_type, reference, status, created_at
         FROM billing.ledger_entries WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    envelope.ledger = ledger.rows;

    const payouts = await pool.query(
      `SELECT id, amount_usd, currency, status, created_at
         FROM payments.payouts WHERE seller_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    envelope.payouts = payouts.rows;

    const earnings = await pool.query(
      `SELECT id, amount_usd, platform_fee_usd, status, created_at
         FROM billing.seller_earnings WHERE seller_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    envelope.seller_earnings = earnings.rows;

    return envelope;
  },

  /**
   * Real deletion: remove the erasable identity data and leave financially
   * significant records (retained) as pseudonymous UUID references. Runs in a
   * transaction; throws on any failure (nothing is partially erased).
   */
  async applyDeletion(userId: string): Promise<{ deleted: string[]; retained: string[] }> {
    const plan = deletionOutcomePlan();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let deletedCount = 0;
      for (const table of plan.erasable) {
        switch (table) {
          case 'auth.users':
            deletedCount += (await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId])).rowCount ?? 0;
            break;
          case 'auth.providers':
            deletedCount += (await client.query(`DELETE FROM auth.providers WHERE user_id = $1`, [userId])).rowCount ?? 0;
            break;
          case 'auth.refresh_tokens':
            deletedCount += (await client.query(`DELETE FROM auth.refresh_tokens WHERE user_id = $1`, [userId])).rowCount ?? 0;
            break;
          case 'users.profiles':
            deletedCount += (await client.query(`DELETE FROM users.profiles WHERE auth_user_id = $1`, [userId])).rowCount ?? 0;
            break;
          case 'billing.wallets':
            deletedCount += (await client.query(`DELETE FROM billing.wallets WHERE customer_id = $1`, [userId])).rowCount ?? 0;
            break;
          default:
            // Unknown entry in the plan must never silently pass.
            throw new Error(`UNKNOWN_ERASABLE_TABLE:${table}`);
        }
      }

      // Pseudonymize retained, financially significant records that reference
      // the identity UUID so accounting integrity is preserved without the
      // personal linkage. (customer_id on billing.sessions is TEXT.)
      await client.query(
        `UPDATE billing.sessions SET customer_id = 'deleted:' || $1 WHERE customer_id = $1`,
        [userId]
      );

      await client.query('COMMIT');
      return { deleted: plan.erasable, retained: plan.retained };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

/** Fire-and-forget audit of a privacy event; never masks the caller error. */
export async function auditPrivacyEvent(input: {
  actor_id?: string | null;
  action: 'privacy.request.create' | 'privacy.request.transition';
  resourceId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await emitAudit({
    actor_id: input.actor_id ?? null,
    action: input.action,
    service: 'privacy',
    resource_type: 'privacy_request',
    resource_id: input.resourceId,
    metadata: input.metadata || {},
  });
}