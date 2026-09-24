import { v4 as uuidv4 } from 'uuid';
import { redisCache } from '../db/redis-cache.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { walletRepository } from '../repositories/wallet.repository.js';
import { sessionProducer } from '../events/producers/session.producer.js';
import { createVpnSession } from '../../session/index.js';
import { marketplaceRepository } from '../../marketplace/repositories/marketplace.repository.js';
import { MIN_SESSION_BALANCE_USD, validateSessionStart } from './session-gate.js';

export { MIN_SESSION_BALANCE_USD, validateSessionStart };
export type { SessionStartGate, SessionStartCheck } from './session-gate.js';

export class SessionManager {
  /**
   * Starts a paid data session.
   * pricePerMb is NEVER taken from the client — it is resolved server-side
   * from the seller's marketplace listing (Redis heartbeat) so that a buyer
   * cannot set their own rate or direct earnings to an arbitrary seller.
   */
  async startSession(userId: string, hardwareId: string, _clientPricePerMb: number | undefined, sellerId: string): Promise<{sessionToken: string; vpnConfig: string}> {
    if (!sellerId) {
      throw new Error('SELLER_REQUIRED');
    }
    if (!hardwareId || typeof hardwareId !== 'string' || !hardwareId.trim()) {
      throw new Error('HARDWARE_REQUIRED');
    }

    // Server-authoritative price from the seller listing.
    const trusted = await marketplaceRepository.getTrustedPricePerMb(sellerId);
    if (!trusted || trusted.pricePerMb <= 0) {
      throw new Error('SELLER_PRICE_UNAVAILABLE');
    }
    const pricePerMb = trusted.pricePerMb;

    const liveBalance = await walletRepository.getBalance(userId);
    const gate = validateSessionStart({
      sellerId,
      hardwareId,
      pricePerMb,
      balanceUsd: liveBalance.balance_usd,
    });
    if (gate !== 'OK') {
      throw new Error(gate);
    }

    const result = await createVpnSession(userId, sellerId, 'auto');
    const sessionToken = result.session_id;
    const vpnConfig = result.vpn_config;

    await sessionRepository.createSession(userId, hardwareId, sessionToken);

    await redisCache.setSession(sessionToken, {
      userId,
      hardwareId,
      pricePerMb,
      sellerId,
      committedBytes: 0,
      pendingCostUsd: 0,
    });

    console.log(`[SessionManager] Session ${sessionToken} authorized for hardware ${hardwareId} with seller ${sellerId} @ ${pricePerMb}/MB`);
    return { sessionToken, vpnConfig };
  }

  async endSession(sessionToken: string): Promise<void> {
    const session = await redisCache.getSession(sessionToken);
    
    if (session) {
      await redisCache.removeSession(sessionToken);
      await sessionRepository.endSession(sessionToken, 'CLOSED');
      console.log(`[SessionManager] Session ${sessionToken} successfully finalized.`);
    }
  }

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