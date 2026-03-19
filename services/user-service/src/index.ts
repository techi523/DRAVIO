import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { pool } from './db/client.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors);
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});
await fastify.register(authMiddleware);

fastify.get('/health', async () => {
  return { status: 'ok', service: 'user-service' };
});

// Create profile (called by auth-service)
fastify.post('/v1/users', async (request, reply) => {
  const { auth_user_id, full_name, country_code } = request.body as any;
  
  const result = await pool.query(
    'INSERT INTO users.profiles (auth_user_id, full_name, country_code) VALUES ($1, $2, $3) RETURNING id',
    [auth_user_id, full_name, country_code]
  );
  
  return { success: true, profileId: result.rows[0].id };
});

// Get self profile
fastify.get('/v1/users/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const authUserId = (request.user as any).sub;
  
  const result = await pool.query(
    'SELECT * FROM users.profiles WHERE auth_user_id = $1',
    [authUserId]
  );
  
  if (result.rows.length === 0) {
    return reply.code(404).send({ success: false, error: 'PROFILE_NOT_FOUND' });
  }
  
  return { success: true, profile: result.rows[0] };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
