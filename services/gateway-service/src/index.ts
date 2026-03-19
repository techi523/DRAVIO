import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

await fastify.register(cors);
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});

fastify.get('/health', async () => {
  return { status: 'ok', service: 'gateway-service' };
});

// Proxy routes to microservices
fastify.register(proxy, {
  upstream: 'http://localhost:3001',
  prefix: '/v1/auth',
  rewritePrefix: '/v1/auth'
});

fastify.register(proxy, {
  upstream: 'http://localhost:3002',
  prefix: '/v1/users',
  rewritePrefix: '/v1/users'
});

fastify.register(proxy, {
  upstream: 'http://localhost:3003',
  prefix: '/v1/marketplace',
  rewritePrefix: '/v1/marketplace'
});

fastify.register(proxy, {
  upstream: 'http://localhost:3004',
  prefix: '/v1/payments',
  rewritePrefix: '/v1/payments'
});

fastify.register(proxy, {
  upstream: 'http://localhost:3005',
  prefix: '/v1/sessions',
  rewritePrefix: '/v1/sessions'
});

fastify.register(proxy, {
  upstream: 'http://localhost:3006',
  prefix: '/v1/billing',
  rewritePrefix: '/v1/billing'
});

const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
