import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionManager } from '../../core/session-manager.js';

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/billing/sessions/start', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { hardwareId, pricePerMb } = request.body as any;
    const userId = (request.user as any).sub;

    try {
      const sessionToken = await sessionManager.startSession(userId, hardwareId, Number(pricePerMb));
      return reply.send({ success: true, sessionToken });
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_FUNDS') {
        return reply.status(402).send({ success: false, error: 'INSUFFICIENT_FUNDS', message: 'Wallet balance depleted' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: 'INTERNAL_SERVER_ERROR' });
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
