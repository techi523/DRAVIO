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
  avg_speed: number | null;
  stability: number | null;
  last_seen: number;
  status: string;
  // Real relay credentials registered by the provider. Absent when the
  // provider has not provisioned a live WireGuard relay.
  relay_endpoint: string | null;
  relay_public_key: string | null;
}

interface SellerStore {
  pricing_model?: string;
  price?: string;
  avg_speed?: string;
  stability?: string;
  status?: string;
  last_seen?: string;
  relay_endpoint?: string;
  relay_public_key?: string;
}

const PLACEHOLDER_PATTERNS = [/\[.*\]/, /\brelay:/i, /\b(example\.com|change_me|localhost)\b/i];

function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

function parseRealNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export class MarketplaceRepository {
  async updateHeartbeat(sellerId: string, input: any) {
    const r = getRedis();
    if (!r) {
      console.warn('[Marketplace] Redis unavailable — heartbeat not stored');
      return;
    }

    const fields: Record<string, string> = {};

    fields.pricing_model = input.pricing?.model?.toString() || 'per_gb';
    if (input.pricing?.rate != null && Number.isFinite(Number(input.pricing.rate)) && Number(input.pricing.rate) > 0) {
      fields.price = Number(input.pricing.rate).toString();
    }

    // Only store measured values. Absent metrics mean "unknown" — never
    // substitute fabricated numbers that buyers could mistake for real data.
    if (input.metrics?.avgSpeed != null && Number.isFinite(Number(input.metrics.avgSpeed)) && Number(input.metrics.avgSpeed) > 0) {
      fields.avg_speed = Number(input.metrics.avgSpeed).toString();
    }
    if (input.metrics?.stability != null && Number.isFinite(Number(input.metrics.stability))) {
      const stability = Number(input.metrics.stability);
      fields.stability = Math.min(100, Math.max(0, stability)).toString();
    }

    fields.status = input.status || 'active';
    fields.last_seen = Date.now().toString();

    // Real relay credentials, stored only when the provider registers a
    // genuinely resolvable endpoint + WireGuard public key.
    if (input.relay?.endpoint && !hasPlaceholder(String(input.relay.endpoint))) {
      fields.relay_endpoint = String(input.relay.endpoint).trim();
    }
    if (input.relay?.publicKey && typeof input.relay.publicKey === 'string' && input.relay.publicKey.trim().length >= 32) {
      fields.relay_public_key = input.relay.publicKey.trim();
    }

    await r.geoadd('active_sellers_geo', input.lon, input.lat, sellerId);
    await r.hset(`seller:${sellerId}`, fields);
    await r.expire(`seller:${sellerId}`, 300);
  }

  /**
   * Direct id-based lookup (no geo scan from the null island).
   * Returns the seller record if present. A listing without a real price is
   * treated as unavailable — no fabricated default price is ever returned.
   */
  async findById(sellerId: string): Promise<SellerMetadata | null> {
    const r = getRedis();
    if (!r) return null;
    try {
      const meta = await r.hgetall(`seller:${sellerId}`);
      if (!meta || !meta.price) return null;

      const price = parseRealNumber(meta.price);
      if (price === null || price <= 0) return null;

      return this.toMetadata(sellerId, meta, 0, 'km');
    } catch (err) {
      console.warn('[Marketplace] findById failed:', (err as Error).message);
      return null;
    }
  }

  /**
   * Resolve the server-authoritative per-MB price for a seller's listing.
   * Used by the billing/session subsystem so clients cannot set their own price.
   */
  async getTrustedPricePerMb(sellerId: string): Promise<{ pricePerMb: number; model: string } | null> {
    const seller = await this.findById(sellerId);
    if (!seller) return null;
    const rate = seller.price_per_gb;
    switch (seller.pricing_model) {
      case 'per_mb':
        return { pricePerMb: rate, model: seller.pricing_model };
      case 'per_gb':
        return rate > 0
          ? { pricePerMb: rate / 1024, model: seller.pricing_model }
          : null;
      default:
        // 'per_hour' and unknown models are not billable per-byte by the backend.
        return null;
    }
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
      // A row whose only price is a synthetic default is useless — require a real rate.
      if (hasPlaceholder(meta.price)) return null;
      const price = parseRealNumber(meta.price);
      if (price === null || price <= 0) return null;

      return this.toMetadata(id, meta, parseFloat(dist), input.unit);
    }).filter(r => r !== null) as SellerMetadata[];
  }

  private toMetadata(id: string, meta: SellerStore, distance: number, unit: string): SellerMetadata {
    const price = parseRealNumber(meta.price);
    return {
      id,
      distance,
      unit,
      pricing_model: meta.pricing_model || 'per_gb',
      price_per_gb: price ?? 0,
      avg_speed: parseRealNumber(meta.avg_speed),
      stability: parseRealNumber(meta.stability),
      status: meta.status || 'active',
      last_seen: parseInt(meta.last_seen || '0'),
      relay_endpoint: meta.relay_endpoint || null,
      relay_public_key: meta.relay_public_key || null,
    };
  }
}

export const marketplaceRepository = new MarketplaceRepository();