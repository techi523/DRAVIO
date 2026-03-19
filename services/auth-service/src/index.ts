import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { authMiddleware } from '@dravio/auth-middleware';
import { pool } from './db/client.js';

const fastify: FastifyInstance = Fastify({ logger: true });

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

// Register plugins
await fastify.register(cors);
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});
await fastify.register(authMiddleware);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', service: 'auth-service' };
});

// Registration logic
fastify.post('/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password, full_name, country_code } = request.body as any;
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      'INSERT INTO auth.users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    
    const userId = result.rows[0].id;
    
    // Call user-service to create profile
    try {
      await axios.post(`${USER_SERVICE_URL}/v1/users`, { 
        auth_user_id: userId, 
        full_name, 
        country_code 
      });
    } catch (userErr) {
      // Rollback auth user if profile creation fails (simplified for MVP)
      await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
      return reply.code(500).send({ success: false, error: 'PROFILE_CREATION_FAILED' });
    }

    return { success: true, userId };
  } catch (err: any) {
    if (err.code === '23505') { // Unique violation
      return reply.code(400).send({ success: false, error: 'EMAIL_ALREADY_EXISTS' });
    }
    throw err;
  }
});

// Login logic
fastify.post('/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as any;
  
  const result = await pool.query('SELECT id, password_hash FROM auth.users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return reply.code(401).send({ success: false, error: 'INVALID_CREDENTIALS' });
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    return reply.code(401).send({ success: false, error: 'INVALID_CREDENTIALS' });
  }

  const token = fastify.jwt.sign({ sub: user.id, roles: ['buyer'] });
  return { success: true, access_token: token };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

