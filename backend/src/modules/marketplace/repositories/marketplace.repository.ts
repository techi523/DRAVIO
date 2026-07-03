import { Redis } from 'ioredis';

let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', (err) => {
    console.warn('[Marketplace Redis] Connection error — operating in degraded mode:', err.message);
  });
} catch (err) {
  console.warn('[Marketplace Redis] Failed to initialize — operating in degraded mode');
}

function getRedis(): Redis | null {
  if (!redis || redis.status !== 'ready') return null;
  return redis;
}

export interface SellerMetadata {
  id: string;
  distance: number;
  unit: string;
  pricing_model: string;
  price_per_gb: number;
  avg_speed: number;
  stability: number;
  last_seen: number;
  status: string;
}

export class MarketplaceRepository {
  async updateHeartbeat(sellerId: string, input: any) {
    const r = getRedis();
    if (!r) {
      console.warn('[Marketplace] Redis unavailable — heartbeat not stored');
      return;
    }
    await r.geoadd('active_sellers_geo', input.lon, input.lat, sellerId);
    await r.hset(`seller:${sellerId}`, {
      pricing_model: input.pricing.model,
      price: input.pricing.rate.toString(),
      avg_speed: (input.metrics?.avgSpeed || 50).toString(),
      stability: (input.metrics?.stability || 100).toString(),
      status: input.status || 'active',
      last_seen: Date.now().toString()
    });
    await r.expire(`seller:${sellerId}`, 300);
  }

  async searchSellers(input: { lat: number, lon: number, radius: number, unit: string }): Promise<SellerMetadata[]> {
    const r = getRedis();
    if (!r) {
      console.warn('[Marketplace] Redis unavailable — returning empty seller results');
      return [];
    }

    const sellerIdsWithDist = await r.geosearch(
      'active_sellers_geo',
      'FROMLONLAT', input.lon, input.lat,
      'BYRADIUS', input.radius, input.unit,
      'WITHDIST'
    ) as any[];

    if (!sellerIdsWithDist || sellerIdsWithDist.length === 0) return [];

    const pipeline = r.pipeline();
    sellerIdsWithDist.forEach(row => {
      pipeline.hgetall(`seller:${row[0]}`);
    });

    const metaResults = await pipeline.exec();
    
    if (!metaResults) return [];

    return sellerIdsWithDist.map((row, index) => {
      const [id, dist] = row;
      const [err, meta] = metaResults[index] as [any, any];
      
      if (err || !meta || !meta.price) return null;

      return {
        id,
        distance: parseFloat(dist),
        unit: input.unit,
        pricing_model: meta.pricing_model || 'per_gb',
        price_per_gb: parseFloat(meta.price || '0.5'),
        avg_speed: parseFloat(meta.avg_speed || '50'),
        stability: parseFloat(meta.stability || '99'),
        status: meta.status || 'active',
        last_seen: parseInt(meta.last_seen || '0')
      };
    }).filter(r => r !== null) as SellerMetadata[];
  }
}

export const marketplaceRepository = new MarketplaceRepository();
