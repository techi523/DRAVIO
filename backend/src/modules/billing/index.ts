import { FastifyInstance } from 'fastify';
import { sessionRoutes } from './api/routes/session.routes.js';
import { usageRoutes } from './api/routes/usage.routes.js';
import { walletRoutes } from './api/routes/wallet.routes.js';
import { startConsumptionProcessor } from './services/consumption.processor.js';

export async function registerBillingRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({ status: 'ok', service: 'billing-service', version: '2.0.0-centralized' }));

  await fastify.register(sessionRoutes);
  await fastify.register(usageRoutes);
  await fastify.register(walletRoutes);

  startConsumptionProcessor().catch(err => {
    fastify.log.error('Failed to start consumption billing processor:', err);
  });
}
