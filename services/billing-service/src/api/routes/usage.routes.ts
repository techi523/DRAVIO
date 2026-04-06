import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { byteTrackerEngine } from '../../core/engines/byte-tracker.js';

export async function usageRoutes(fastify: FastifyInstance) {
  // Usage updates usually come from secure hardware layers. 
  // We can lock this down further with a specific role check if desired.
  fastify.post('/v1/billing/usage/update', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionToken, bytesUsed } = request.body as any;

    try {
      // Async process to avoid blocking the fast hardware ingestion
      // In production, this might push directly to Kafka instead of processing inline.
      await byteTrackerEngine.processUsageUpdate(sessionToken, BigInt(bytesUsed));
      
      return reply.send({ success: true, message: 'Usage processed successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    }
  });
}
