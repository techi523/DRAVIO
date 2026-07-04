import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HeartbeatSchema, SearchSchema } from './schema/marketplace.schema.js';
import { marketplaceService } from './services/marketplace.service.js';
import { sendSuccess, sendError } from './utils/response.js';

export async function registerMarketplaceRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/marketplace/heartbeat', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      const results = await marketplaceService.findNearbySellers({ lat: 0, lon: 0, radius: 10000, unit: 'km' });
      return sendSuccess(reply, { results });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/marketplace/sellers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    try {
      const sellers = await marketplaceService.findNearbySellers({ lat: 0, lon: 0, radius: 10000, unit: 'km' });
      const found = (sellers as any).find((s: any) => s.id === id);
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
