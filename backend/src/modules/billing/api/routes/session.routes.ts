import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionManager } from '../../core/session-manager.js';

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/billing/sessions/start', { 
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // NOTE: pricePerMb is deliberately ignored — the backend resolves the
    // authoritative price from the seller's marketplace listing.
    const { hardwareId, sellerId } = request.body as any;
    const userId = (request.user as any).sub;

    try {
      const result = await sessionManager.startSession(userId, hardwareId, undefined, sellerId || '');
      return reply.send({ success: true, sessionToken: result.sessionToken, vpn_config: result.vpnConfig });
    } catch (err: any) {
      switch (err.message) {
        case 'INSUFFICIENT_FUNDS':
          return reply.status(402).send({ success: false, error: 'INSUFFICIENT_FUNDS', message: 'Wallet balance depleted' });
        case 'SELLER_REQUIRED':
          return reply.status(400).send({ success: false, error: 'SELLER_REQUIRED', message: 'A seller must be selected' });
        case 'HARDWARE_REQUIRED':
          return reply.status(400).send({ success: false, error: 'HARDWARE_REQUIRED', message: 'hardwareId is required' });
        case 'SELLER_PRICE_UNAVAILABLE':
          return reply.status(503).send({ success: false, error: 'SELLER_PRICE_UNAVAILABLE', message: 'Selected seller has no active listing or incompatible pricing model' });
        case 'SELLER_LISTING_UNAVAILABLE':
          return reply.status(409).send({ success: false, error: 'SELLER_LISTING_UNAVAILABLE', message: 'Selected seller has no active marketplace listing' });
        case 'SELLER_RELAY_NOT_REGISTERED':
          return reply.status(409).send({ success: false, error: 'SELLER_RELAY_NOT_REGISTERED', message: 'Selected provider has not registered a live relay — session cannot start' });
        default:
          fastify.log.error(err);
          return reply.status(500).send({ success: false, error: 'INTERNAL_SERVER_ERROR' });
      }
    }
  });

  fastify.post('/v1/billing/sessions/end', { 
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionToken } = request.body as any;
    try {
      await sessionManager.endSession(sessionToken);
      return reply.send({ success: true, message: 'Session successfully terminated' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    }
  });
}