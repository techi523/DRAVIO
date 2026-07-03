import { v4 as uuidv4 } from 'uuid';
import { redisCache } from '../db/redis-cache.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { walletRepository } from '../repositories/wallet.repository.js';
import { sessionProducer } from '../events/producers/session.producer.js';
import { createVpnSession } from '../../session/index.js';

export class SessionManager {
  async startSession(userId: string, hardwareId: string, pricePerMb: number, sellerId: string): Promise<{sessionToken: string; vpnConfig: string}> {
    const liveBalance = await walletRepository.getBalance(userId);
    
    if (liveBalance.balance_usd <= 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const result = await createVpnSession(userId, sellerId || hardwareId, 'auto');
    const sessionToken = result.session_id;
    const vpnConfig = result.vpn_config;

    await sessionRepository.createSession(userId, hardwareId, sessionToken);

    await redisCache.setSession(sessionToken, {
      userId,
      hardwareId,
      pricePerMb,
      sellerId
    });

    console.log(`[SessionManager] Session ${sessionToken} authorized for hardware ${hardwareId} with seller ${sellerId}`);
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
