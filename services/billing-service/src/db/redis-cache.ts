import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err: any) => console.error('Redis Client Error', err));

export interface ActiveSessionCache {
  userId: string;
  hardwareId: string;
  pricePerMb: number;
  sellerId: string;
}

export class RedisCache {
  async connect() {
    if (!redis.isOpen) {
      await redis.connect();
    }
  }

  async setSession(sessionToken: string, sessionData: ActiveSessionCache) {
    await this.connect();
    await redis.set(`session:${sessionToken}`, JSON.stringify(sessionData));
  }

  async getSession(sessionToken: string): Promise<ActiveSessionCache | null> {
    await this.connect();
    const data = await redis.get(`session:${sessionToken}`);
    if (!data) return null;
    return JSON.parse(data) as ActiveSessionCache;
  }

  async removeSession(sessionToken: string) {
    await this.connect();
    await redis.del(`session:${sessionToken}`);
  }
}

export const redisCache = new RedisCache();
