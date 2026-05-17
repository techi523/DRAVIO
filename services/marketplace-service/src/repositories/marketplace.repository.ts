import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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
    await redis.geoadd('active_sellers_geo', input.lon, input.lat, sellerId);
    await redis.hset(`seller:${sellerId}`, {
      pricing_model: input.pricing.model,
      price: input.pricing.rate.toString(),
      avg_speed: (input.metrics?.avgSpeed || 50).toString(),
      stability: (input.metrics?.stability || 100).toString(),
      status: input.status || 'active',
      last_seen: Date.now().toString()
    });
    await redis.expire(`seller:${sellerId}`, 300);
  }

  async searchSellers(input: { lat: number, lon: number, radius: number, unit: string }): Promise<SellerMetadata[]> {
    const sellerIdsWithDist = await redis.geosearch(
      'active_sellers_geo',
      'FROMLONLAT', input.lon, input.lat,
      'BYRADIUS', input.radius, input.unit,
      'WITHDIST'
    ) as any[];

    if (!sellerIdsWithDist || sellerIdsWithDist.length === 0) return [];

    // Phase 6: Performance Optimization - Batch metadata lookups via Pipeline
    const pipeline = redis.pipeline();
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

