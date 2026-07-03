import { Redis } from 'ioredis';

let redis: Redis | null = null;

function initRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — operating without Redis cache');
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Redis] Max retries reached — operating without Redis');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err) => {
      console.warn('[Redis] Connection error (degraded mode):', err.message);
    });

    client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    return client;
  } catch (err) {
    console.warn('[Redis] Failed to initialize — operating without Redis');
    return null;
  }
}

export function getRedis(): Redis | null {
  if (!redis) {
    redis = initRedis();
    if (redis) {
      redis.connect().catch(() => {
        console.warn('[Redis] Initial connection failed — degraded mode');
      });
    }
  }
  return redis;
}

export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === 'ready';
}
