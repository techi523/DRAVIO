import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { CreateProfileSchema } from './schema/user.schema.js';
import { userRepository } from './repositories/user.repository.js';
import { sendSuccess, sendError } from './utils/response.js';

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          headers: request.headers,
          remoteAddress: request.ip,
        };
      },
    },
  } 
});

async function init() {
  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });
  await fastify.register(authMiddleware);
}

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'user-service' }));

// Create profile (Internal call from auth-service)
fastify.post('/v1/users', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = CreateProfileSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const profileId = await userRepository.create(result.data);
    return sendSuccess(reply, { profileId }, 201);
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Get self profile
fastify.get('/v1/users/me', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const authUserId = (request.user as any).sub;
  
  try {
    const profile = await userRepository.findByAuthId(authUserId);
    if (!profile) {
      return sendError(reply, 'PROFILE_NOT_FOUND', 404);
    }
    return sendSuccess(reply, { profile });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3002');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`User service listening on port ${port}`);
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
