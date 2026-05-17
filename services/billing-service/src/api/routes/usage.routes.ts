import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { byteTrackerEngine } from '../../core/engines/byte-tracker.js';

export async function usageRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/billing/usage', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId, dataUsedMb } = request.body as any;

    try {
      // Convert MB back to bytes for the internal engine if needed, 
      // or update engine to handle MB. Assuming bytes for consistency.
      const bytes = BigInt(Math.floor(dataUsedMb * 1024 * 1024));
      
      await byteTrackerEngine.processUsageUpdate(sessionId, bytes);
      
      return reply.send({ success: true });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    }
  });
}

