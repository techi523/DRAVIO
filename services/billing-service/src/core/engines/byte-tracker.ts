import { redisCache } from '../../db/redis-cache.js';
import { walletRepository } from '../../repositories/wallet.repository.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { sessionProducer } from '../../events/producers/session.producer.js';
import { pool } from '../../db/client.js';

export class ByteTrackerEngine {
  /**
   * Processes hardware byte metrics into financial limits.
   * If usage exceeds balance, triggers the Kill Switch across the network.
   */
  async processUsageUpdate(sessionToken: string, bytesUsed: bigint) {
    // 1. Live state verification via high-speed cache
    const session = await redisCache.getSession(sessionToken);
    if (!session) {
      console.warn(`[ByteTracker] Ignored usage report for untracked session: ${sessionToken}`);
      return; // Could also send a hard kill signal here to destroy zombie sessions
    }

    // 2. Pricing and Conversion
    const mbUsed = Number(bytesUsed) / (1024 * 1024);
    const cost = mbUsed * session.pricePerMb;

    if (cost <= 0) return; // Skip zero-cost micro-reports

    try {
      // 3. Database consistency atomic deduction from user's prepaid escrow balance
      const currentLiveBalance = await walletRepository.directDeduct(session.userId, cost);
      
      // Update session statistics
      await sessionRepository.updateSessionUsage(sessionToken, bytesUsed, cost);

      // 3.1 Credit the seller's wallet and log seller earnings
      const platformFeePct = parseFloat(process.env.PLATFORM_FEE_PCT || '0.10');
      const platformFee = cost * platformFeePct;
      const sellerNet = cost - platformFee;

      if (session.sellerId && sellerNet > 0) {
        await walletRepository.topup(session.sellerId, sellerNet);
        
        // Find session UUID in the database using sessionToken to satisfy foreign key constraints
        const sessionRecord = await sessionRepository.getActiveSession(sessionToken);
        const sessionId = sessionRecord ? sessionRecord.id : '00000000-0000-0000-0000-000000000000';
        
        await pool.query(
          `INSERT INTO billing.seller_earnings (seller_id, session_id, amount_usd, platform_fee_usd, status)
           VALUES ($1, $2, $3, $4, 'SETTLED')`,
          [session.sellerId, sessionId, sellerNet, platformFee]
        );
      }

      // 4. Threshold & Kill Execution
      if (currentLiveBalance <= 0) {
        console.log(`[ByteTracker] User ${session.userId} bankrupt. Terminating Session.`);
        await sessionProducer.broadcastKillSwitch(sessionToken, session.hardwareId, session.userId, "INSUFFICIENT_FUNDS");
        
        // Finalize DB
        await sessionRepository.endSession(sessionToken, 'KILLED');
        await redisCache.removeSession(sessionToken);
      } else if (currentLiveBalance < 0.50) {
         // (Optional) push warning to mobile app
         console.log(`[ByteTracker] User ${session.userId} balance warning: $${currentLiveBalance.toFixed(2)}`);
      }

    } catch (err: any) {
      // If we attempt directDeduct and it throws INSUFFICIENT_FUNDS due to DB constraint
      if (err.message === "INSUFFICIENT_FUNDS") {
        await sessionProducer.broadcastKillSwitch(sessionToken, session.hardwareId, session.userId, "INSUFFICIENT_FUNDS");
        await sessionRepository.endSession(sessionToken, 'KILLED');
        await redisCache.removeSession(sessionToken);
      } else {
        console.error('[ByteTracker] Financial deduction error:', err);
      }
    }
  }
}

export const byteTrackerEngine = new ByteTrackerEngine();
