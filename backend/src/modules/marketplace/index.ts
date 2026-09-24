import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HeartbeatSchema, SearchSchema } from './schema/marketplace.schema.js';
import { marketplaceService } from './services/marketplace.service.js';
import { sendSuccess, sendError } from './utils/response.js';

export async function registerMarketplaceRoutes(fastify: FastifyInstance) {
  // SELLER-role enforced: only actual sellers may publish a heartbeat/listing.
  fastify.post('/v1/marketplace/heartbeat', { preHandler: [fastify.authorize(['SELLER'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = HeartbeatSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    const sellerId = (request.user as any).sub;

    try {
      await marketplaceService.registerHeartbeat(sellerId, result.data);
      return sendSuccess(reply, { success: true });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/marketplace/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = SearchSchema.safeParse(request.query);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      const results = await marketplaceService.findNearbySellers(result.data);
      return sendSuccess(reply, { results });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/marketplace/sellers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Global seller listing is served from the marketplace store keys directly
      // (no null-island geo scan), with a sane cap.
      const { getRedis } = await import('../../db/redis.js');
      const redis = getRedis();
      let results: any[] = [];
      if (redis) {
        const keys = await redis.keys('seller:*');
        for (const key of keys.slice(0, 100)) {
          const meta = await redis.hgetall(key);
          if (meta && meta.status === 'active') {
            const id = key.slice('seller:'.length);
            const price = parseFloat(meta.price || '');
            // No fabricated price/quality defaults — listings without a real
            // published rate are excluded until the provider configures one.
            if (!meta.price || !Number.isFinite(price) || price <= 0) continue;
            results.push({
              id,
              pricing_model: meta.pricing_model || 'per_gb',
              price_per_gb: price,
              avg_speed: meta.avg_speed ? parseFloat(meta.avg_speed) : null,
              stability: meta.stability ? parseFloat(meta.stability) : null,
              relay_endpoint: meta.relay_endpoint || null,
              relay_public_key: meta.relay_public_key || null,
            });
          }
        }
      }
      return sendSuccess(reply, { results });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/marketplace/sellers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    try {
      // O(1) direct lookup instead of a full marketplace scan.
      const found = await marketplaceService.findById(id);
      if (!found) {
        return sendError(reply, 'SELLER_NOT_FOUND', 404);
      }
      return sendSuccess(reply, found);
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}
