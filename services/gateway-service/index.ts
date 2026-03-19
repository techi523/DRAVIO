import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';

const fastify = Fastify({ logger: true });

// Route to Auth Service
fastify.register(proxy, {
  upstream: 'http://auth-service:3000',
  prefix: '/auth'
});

// Route to Marketplace Service
fastify.register(proxy, {
  upstream: 'http://marketplace-service:3000',
  prefix: '/marketplace'
});

fastify.listen({ port: 80, host: '0.0.0.0' });
