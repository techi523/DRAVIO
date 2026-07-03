import { redisCache } from '../../db/redis-cache.js';
import { walletRepository } from '../../repositories/wallet.repository.js';
import { sessionRepository } from '../../repositories/session.repository.js';
import { sessionProducer } from '../../events/producers/session.producer.js';
import { pool } from '../../../../db/client.js';

export class ByteTrackerEngine {
  async processUsageUpdate(sessionToken: string, bytesUsed: bigint) {
    const session = await redisCache.getSession(sessionToken);
    if (!session) {
      console.warn(`[ByteTracker] Ignored usage report for untracked session: ${sessionToken}`);
      return;
    }

    const mbUsed = Number(bytesUsed) / (1024 * 1024);
    const cost = mbUsed * session.pricePerMb;

    if (cost <= 0) return;

    try {
      const currentLiveBalance = await walletRepository.directDeduct(session.userId, cost);
      
      await sessionRepository.updateSessionUsage(sessionToken, bytesUsed, cost);

      const platformFeePct = parseFloat(process.env.PLATFORM_FEE_PCT || '0.10');
      const platformFee = cost * platformFeePct;
      const sellerNet = cost - platformFee;

      if (session.sellerId && sellerNet > 0) {
        await walletRepository.topup(session.sellerId, sellerNet);
        
        const sessionRecord = await sessionRepository.getActiveSession(sessionToken);
        const sessionId = sessionRecord ? sessionRecord.id : '00000000-0000-0000-0000-000000000000';
        
        await pool.query(
          `INSERT INTO billing.seller_earnings (seller_id, session_id, amount_usd, platform_fee_usd, status)
           VALUES ($1, $2, $3, $4, 'SETTLED')`,
          [session.sellerId, sessionId, sellerNet, platformFee]
        );
      }

      if (currentLiveBalance <= 0) {
        console.log(`[ByteTracker] User ${session.userId} bankrupt. Terminating Session.`);
        await sessionProducer.broadcastKillSwitch(sessionToken, session.hardwareId, session.userId, "INSUFFICIENT_FUNDS");
        
        await sessionRepository.endSession(sessionToken, 'KILLED');
        await redisCache.removeSession(sessionToken);
      } else if (currentLiveBalance < 0.50) {
         console.log(`[ByteTracker] User ${session.userId} balance warning: $${currentLiveBalance.toFixed(2)}`);
      }

    } catch (err: any) {
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
