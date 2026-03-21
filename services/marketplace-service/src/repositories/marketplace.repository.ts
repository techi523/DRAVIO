import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface SellerMetadata {
  id: string;
  distance: number;
  unit: string;
  price_per_gb: number;
  last_seen: number;
}

export class MarketplaceRepository {
  async updateHeartbeat(sellerId: string, input: { lat: number, lon: number, price_per_gb: number }) {
    await redis.geoadd('active_sellers_geo', input.lon, input.lat, sellerId);
    await redis.hset(`seller:${sellerId}`, {
      price: input.price_per_gb.toString(),
      last_seen: Date.now().toString()
    });
    await redis.expire(`seller:${sellerId}`, 300);
  }

  async searchSellers(input: { lat: number, lon: number, radius: number, unit: string }): Promise<SellerMetadata[]> {
    const sellerIds = await redis.geosearch(
      'active_sellers_geo',
      'FROMLONLAT', input.lon, input.lat,
      'BYRADIUS', input.radius, input.unit,
      'WITHDIST'
    ) as any[];

    if (!sellerIds) return [];

    return await Promise.all(sellerIds.map(async (row: any) => {
      const [id, dist] = row;
      const meta = await redis.hgetall(`seller:${id}`);
      return {
        id,
        distance: parseFloat(dist),
        unit: input.unit,
        price_per_gb: parseFloat(meta.price || '0'),
        last_seen: parseInt(meta.last_seen || '0')
      };
    }));
  }
}

export const marketplaceRepository = new MarketplaceRepository();
