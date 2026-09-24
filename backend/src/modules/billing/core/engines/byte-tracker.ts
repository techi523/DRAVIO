import { redisCache } from '../../db/redis-cache.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { sessionProducer } from '../../events/producers/session.producer.js';
import { pool } from '../../../../db/client.js';
import { computeFees } from '../../../payment/money.js';
import { computeBillingDecision } from '../billing-decision.js';

const LOW_BALANCE_WARNING = 0.50;

/**
 * Usage is billed only for the DELTA since the last committed byte counter.
 * committedBytes is persisted in the Redis session record and updated ONLY
 * after the money movement transaction commits — so duplicate/reordered
 * usage reports cannot double-bill the buyer.
 * Money movement (buyer debit + seller credit + earnings) happens in a single
 * DB transaction.
 */
export class ByteTrackerEngine {
  async processUsageUpdate(sessionToken: string, bytesUsed: bigint) {
    const session = await redisCache.getSession(sessionToken);
    if (!session) {
      console.warn(`[ByteTracker] Ignored usage report for untracked session: ${sessionToken}`);
      return;
    }

    const committed = BigInt(session.committedBytes || 0);
    const pendingBefore = Number(session.pendingCostUsd || 0);
    const decision = computeBillingDecision(committed, bytesUsed, session.pricePerMb, pendingBefore);

    if (!decision.billable) {
      return; // Replay or non-increasing report — nothing to bill.
    }
    if (decision.exactCost <= 0) {
      return;
    }

    // Wallets store cents. Aggregate fractional cents into the carry-over and
    // settle only whole-cent amounts so per-MB micro-charges are never lost
    // or improperly rounded.
    const cost = decision.settledCost;
    const carryOver = decision.carryOver;

    if (cost < 0.01) {
      // Not yet a whole cent — just persist the carry-over, no money moves.
      await redisCache.updatePendingCost(sessionToken, carryOver);
      return;
    }

    const fees = computeFees(cost);
    const sellerNet = fees.sellerNetUsd;

    const client = await pool.connect();
    let committedNow = false;
    try {
      await client.query('BEGIN');

      // Atomic debit — no TOCTOU: only succeeds if balance covers the cost.
      const debit = await client.query(
        `UPDATE billing.wallets
            SET balance_usd = balance_usd - $2,
                updated_at  = NOW()
          WHERE customer_id = $1
            AND balance_usd >= $2
          RETURNING balance_usd`,
        [session.userId, cost]
      );

      if (debit.rowCount === 0) {
        await client.query('ROLLBACK');
        await this.killInsufficientFunds(session, sessionToken);
        return;
      }

      // Credit the marketplace seller for the session.
      if (session.sellerId && sellerNet > 0) {
        await client.query(
          `INSERT INTO billing.wallets (customer_id, balance_usd)
           VALUES ($1, $2)
           ON CONFLICT (customer_id) DO UPDATE
              SET balance_usd = billing.wallets.balance_usd + $2,
                  updated_at = CURRENT_TIMESTAMP`,
          [session.sellerId, sellerNet]
        );
      }

      const sessionRow = await client.query(
        `SELECT id FROM billing.sessions WHERE session_token = $1 AND status = 'ACTIVE'`,
        [sessionToken]
      );
      const sessionId = sessionRow.rowCount
        ? sessionRow.rows[0].id
        : '00000000-0000-0000-0000-000000000000';

      await client.query(
        `INSERT INTO billing.seller_earnings (seller_id, session_id, amount_usd, platform_fee_usd, status)
         VALUES ($1, $2, $3, $4, 'SETTLED')`,
        [session.sellerId, sessionId, sellerNet, fees.platformFeeUsd]
      );

      await client.query('COMMIT');
      committedNow = true;
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.message === 'INSUFFICIENT_FUNDS' || err.message === 'INSUFFICIENT_BALANCE') {
        await this.killInsufficientFunds(session, sessionToken);
        return;
      }
      console.error('[ByteTracker] Financial deduction error:', err);
      return;
    } finally {
      client.release();
    }

    if (!committedNow) {
      return; // Money did not move — do not advance the committed byte counter.
    }

    await sessionRepository.updateSessionUsage(sessionToken, bytesUsed, cost);

    await redisCache.updateCommittedBytes(sessionToken, Number(bytesUsed));
    await redisCache.updatePendingCost(sessionToken, carryOver);

    await redisCache.updateCommittedBytes(sessionToken, Number(bytesUsed));

    const liveBalance = await this.currentBalance(session.userId);
    if (liveBalance !== null && liveBalance <= 0) {
      console.log(`[ByteTracker] User ${session.userId} bankrupt. Terminating Session.`);
      await this.killInsufficientFunds(session, sessionToken);
    } else if (liveBalance !== null && liveBalance < LOW_BALANCE_WARNING) {
      console.log(`[ByteTracker] User ${session.userId} balance warning: $${liveBalance.toFixed(2)}`);
    }
  }

  private async currentBalance(userId: string): Promise<number | null> {
    try {
      const result = await pool.query(
        'SELECT balance_usd FROM billing.wallets WHERE customer_id = $1',
        [userId]
      );
      return result.rowCount ? Number(result.rows[0].balance_usd) : null;
    } catch {
      return null;
    }
  }

  private async killInsufficientFunds(session: any, sessionToken: string) {
    try {
      await sessionProducer.broadcastKillSwitch(sessionToken, session.hardwareId, session.userId, 'INSUFFICIENT_FUNDS');
    } catch (err: any) {
      console.error('[ByteTracker] Kill-switch broadcast failed:', err.message);
    }
    await sessionRepository.endSession(sessionToken, 'KILLED');
    await redisCache.removeSession(sessionToken);
  }
}

export const byteTrackerEngine = new ByteTrackerEngine();