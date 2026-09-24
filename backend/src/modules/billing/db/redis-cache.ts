import { createClient, RedisClientType } from 'redis';

let redis: RedisClientType | null = null;
let redisEnabled = true;

try {
  redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }) as RedisClientType;

  redis.on('error', (err: any) => {
    console.warn('[Redis Cache] Connection error — operating in degraded mode:', err.message);
    redisEnabled = false;
  });

  redis.on('connect', () => {
    redisEnabled = true;
  });

  redis.on('end', () => {
    redisEnabled = false;
  });
} catch (err) {
  console.warn('[Redis Cache] Failed to initialize — operating in degraded mode');
  redisEnabled = false;
}

export interface ActiveSessionCache {
  userId: string;
  hardwareId: string;
  pricePerMb: number;
  sellerId: string;
  /** Bytes already billed for this session — usage reports bill only the delta. */
  committedBytes: number;
  /**
   * Fractional-cent cost carried over (wallet stores cents only). Accumulated
   * across reports and settled whenever it reaches a whole cent, so micro
   * charges are never lost and never create rounding errors.
   */
  pendingCostUsd: number;
}

export class RedisCache {
  async connect() {
    if (!redis || !redisEnabled) return false;
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      return true;
    } catch {
      redisEnabled = false;
      return false;
    }
  }

  async setSession(sessionToken: string, sessionData: ActiveSessionCache) {
    if (!(await this.connect())) return;
    try {
      await redis!.set(`session:${sessionToken}`, JSON.stringify(sessionData));
    } catch (err: any) {
      console.warn('[Redis Cache] Failed to set session:', err.message);
    }
  }

  async getSession(sessionToken: string): Promise<ActiveSessionCache | null> {
    if (!(await this.connect())) return null;
    try {
      const data = await redis!.get(`session:${sessionToken}`);
      if (!data) return null;
      return JSON.parse(data) as ActiveSessionCache;
    } catch (err: any) {
      console.warn('[Redis Cache] Failed to get session:', err.message);
      return null;
    }
  }

  async removeSession(sessionToken: string) {
    if (!(await this.connect())) return;
    try {
      await redis!.del(`session:${sessionToken}`);
    } catch (err: any) {
      console.warn('[Redis Cache] Failed to remove session:', err.message);
    }
  }

  async updateCommittedBytes(sessionToken: string, bytes: number) {
    const session = await this.getSession(sessionToken);
    if (!session) return;
    session.committedBytes = bytes;
    await this.setSession(sessionToken, session);
  }

  async updatePendingCost(sessionToken: string, pendingCostUsd: number) {
    const session = await this.getSession(sessionToken);
    if (!session) return;
    session.pendingCostUsd = pendingCostUsd;
    await this.setSession(sessionToken, session);
  }
}

export const redisCache = new RedisCache();
