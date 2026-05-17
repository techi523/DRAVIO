import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authMiddleware } from '@dravio/auth-middleware';

// New Architecture Routes
import { sessionRoutes } from './api/routes/session.routes.js';
import { usageRoutes } from './api/routes/usage.routes.js';
import { walletRoutes } from './api/routes/wallet.routes.js';
import { startConsumptionProcessor } from './services/consumption.processor.js';

// Setup Base Server
const fastify: FastifyInstance = Fastify({ 
  logger: { level: 'info' } 
});

async function init() {
  await fastify.register(cors);

  // Security Hardening: Global Rate Limiting (Phase 4)
  await fastify.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Try again in ${context.after}.`
    })
  });
  
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });
  
  await fastify.register(authMiddleware);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'billing-service', version: '2.0.0-centralized' }));

  // Register modern modular routes
  await fastify.register(sessionRoutes);
  await fastify.register(usageRoutes);
  await fastify.register(walletRoutes);
}

const start = async () => {
  try {
    await init();
    const port = parseInt(process.env.PORT || '3006');
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Billing Engine Core listening on port ${port}`);

    // Start live consumption tracker
    await startConsumptionProcessor().catch(err => {
      fastify.log.error('Failed to start consumption billing processor:', err);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
