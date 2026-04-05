import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { HeartbeatSchema, SearchSchema } from './schema/marketplace.schema.js';
import { marketplaceService } from './services/marketplace.service.js';
import { sendSuccess, sendError } from './utils/response.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: 'info'
  } 
});

async function init() {
  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });
  await fastify.register(authMiddleware);

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
}

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'marketplace-service' }));

// Seller heartbeat
fastify.post('/v1/marketplace/heartbeat', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const result = HeartbeatSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  const sellerId = (request.user as any).sub;

  try {
    await marketplaceService.registerHeartbeat(sellerId, result.data);
    return sendSuccess(reply, { success: true });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Search sellers by geo-location
fastify.get('/v1/marketplace/search', async (request: FastifyRequest, reply: FastifyReply) => {
  // Use query params
  const result = SearchSchema.safeParse(request.query);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const results = await marketplaceService.findNearbySellers(result.data);
    return sendSuccess(reply, { results });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// List all sellers
fastify.get('/v1/marketplace/sellers', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const results = await marketplaceService.findNearbySellers({ lat: 0, lon: 0, radius: 10000, unit: 'km' });
    return sendSuccess(reply, { results });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Get specific seller
fastify.get('/v1/marketplace/sellers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  try {
    const sellers = await marketplaceService.findNearbySellers({ lat: 0, lon: 0, radius: 10000, unit: 'km' });
    const found = (sellers as any).find((s: any) => s.id === id);
    if (!found) {
        return sendError(reply, 'SELLER_NOT_FOUND', 404);
    }
    return sendSuccess(reply, found);
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Marketplace service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

async function bootstrap() {
  await init();
  await start();
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
