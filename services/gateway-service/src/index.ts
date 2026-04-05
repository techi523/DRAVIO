import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

async function init() {
  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });

  // Root health check (ISSUE 1 Fix)
  fastify.get('/', async () => {
    return {
      status: "ok",
      service: "dravio-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: "development"
    };
  });

  // Dedicated health check
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'gateway-service' };
  });

  // Proxy routes to microservices (NEXT 1 Structure)
  // Auth
  fastify.register(proxy, {
    upstream: 'http://auth-service:3000/v1/auth',
    prefix: '/auth'
  });

  // Marketplace
  fastify.register(proxy, {
    upstream: 'http://marketplace-service:3000/v1/marketplace',
    prefix: '/marketplace'
  });

  // Sessions
  fastify.register(proxy, {
    upstream: 'http://session-service:3005/v1/sessions',
    prefix: '/sessions'
  });

  // Wallet (Billing)
  fastify.register(proxy, {
    upstream: 'http://billing-service:3006/v1/billing',
    prefix: '/wallet'
  });

  // Legacy mappings (internal/refactored)
  fastify.register(proxy, {
    upstream: 'http://user-service:3002/v1/users',
    prefix: '/v1/users'
  });
}

const start = async () => {
  try {
    await init();
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log('Gateway service listening on port 8000');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
