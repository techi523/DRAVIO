import { v4 as uuidv4 } from 'uuid';
import { redisCache } from '../db/redis-cache.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { walletRepository } from '../repositories/wallet.repository.js';
import { sessionProducer } from '../events/producers/session.producer.js';

export class SessionManager {
  /**
   * Initializes a session, locks an escrow limit (optional but recommended),
   * and authorizes the hardware layer to route packets.
   */
  async startSession(userId: string, hardwareId: string, pricePerMb: number, sellerId: string): Promise<{sessionToken: string; vpnConfig: string}> {
    const liveBalance = await walletRepository.getBalance(userId);
    
    // Hard constraint - prevent connection if broke
    if (liveBalance.balance_usd <= 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const sessionUrl = process.env.SESSION_SERVICE_URL
      ? `${process.env.SESSION_SERVICE_URL}/v1/sessions`
      : (process.env.LOCAL_DEV === 'true' ? 'http://localhost:3005/v1/sessions' : 'http://session-service:3005/v1/sessions');
    const res = await fetch(sessionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_id: userId, seller_id: sellerId || hardwareId, region: 'auto' })
    });

    if (!res.ok) {
      throw new Error('FAILED_TO_PROVISION_VPN_TUNNEL');
    }
    const data = await res.json() as any;
    const sessionToken = data.session_id;
    const vpnConfig = data.vpn_config;

    // 1. Persist audit trail in relational DB
    await sessionRepository.createSession(userId, hardwareId, sessionToken);

    // 2. Put into hot memory so ByteTracker can deduct within milliseconds
    await redisCache.setSession(sessionToken, {
      userId,
      hardwareId,
      pricePerMb,
      sellerId
    });

    console.log(`[SessionManager] Session ${sessionToken} authorized for hardware ${hardwareId} with seller ${sellerId}`);
    return { sessionToken, vpnConfig };
  }

  /**
   * Gracefully ends the session without a Kill-switch emission 
   * (e.g. User pressed 'Disconnect' manually).
   */
  async endSession(sessionToken: string): Promise<void> {
    const session = await redisCache.getSession(sessionToken);
    
    if (session) {
      await redisCache.removeSession(sessionToken);
      await sessionRepository.endSession(sessionToken, 'CLOSED');
      console.log(`[SessionManager] Session ${sessionToken} successfully finalized.`);
    }
  }

  /**
   * Overrides hardware by forcibly executing the kill sequence and clearing session state.
   */
  async killSession(sessionToken: string, reason: string): Promise<void> {
    const session = await redisCache.getSession(sessionToken);
    if (session) {
      await sessionProducer.broadcastKillSwitch(sessionToken, session.hardwareId, session.userId, reason);
      await redisCache.removeSession(sessionToken);
      await sessionRepository.endSession(sessionToken, 'KILLED');
    }
  }
}

export const sessionManager = new SessionManager();
