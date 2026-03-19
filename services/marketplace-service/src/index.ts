import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { Redis } from 'ioredis';
import { authMiddleware } from '@dravio/auth-middleware';

const fastify: FastifyInstance = Fastify({ logger: true });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

await fastify.register(cors);
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});
await fastify.register(authMiddleware);

fastify.get('/health', async () => {
  return { status: 'ok', service: 'marketplace-service' };
});

// Seller heartbeat: updates location and availability in Redis
fastify.post('/v1/marketplace/heartbeat', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const sellerId = (request.user as any).sub;
  const { lat, lon, price_per_gb } = request.body as any;
  
  // Store location for geo-search (expiry 5 mins)
  await redis.geoadd('active_sellers_geo', lon, lat, sellerId);
  
  // Store metadata in a hash with 300s TTL
  await redis.hset(`seller:${sellerId}`, {
    price: price_per_gb,
    last_seen: Date.now().toString()
  });
  await redis.expire(`seller:${sellerId}`, 300);

  return { success: true };
});

// Search sellers by geo-location (real Redis GEOSEARCH)
fastify.get('/v1/marketplace/search', async (request: FastifyRequest, reply: FastifyReply) => {
  const { lat, lon, radius = 5, unit = 'km' } = request.query as any;
  
  // Find sellers within radius
  const sellerIds = await redis.geosearch(
    'active_sellers_geo',
    'FROMLONLAT', lon, lat,
    'BYRADIUS', radius, unit,
    'WITHDIST'
  ) as any[];

  // Fetch metadata for each seller
  const results = await Promise.all(sellerIds.map(async (row: any) => {
    const [id, dist] = row;
    const meta = await redis.hgetall(`seller:${id}`);
    return {
      id,
      distance: dist,
      unit,
      price_per_gb: parseFloat(meta.price || '0'),
      last_seen: parseInt(meta.last_seen || '0')
    };
  }));

  return { results };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3003');
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

