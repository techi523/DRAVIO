import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';

// New Architecture Routes
import { sessionRoutes } from './api/routes/session.routes.js';
import { usageRoutes } from './api/routes/usage.routes.js';
import { walletRoutes } from './api/routes/wallet.routes.js';

// Setup Base Server
const fastify: FastifyInstance = Fastify({ 
  logger: { level: 'info' } 
});

async function init() {
  await fastify.register(cors);
  
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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
