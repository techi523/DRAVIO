import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { RegisterSchema, LoginSchema } from './schema/auth.schema.js';
import { authService } from './services/auth.service.js';
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
          hostname: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket.remotePort,
        };
      },
    },
  } 
});

async function init() {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.');
  }

  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });
  await fastify.register(authMiddleware);
}

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() }));

// Registration
fastify.post('/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = RegisterSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const userId = await authService.register(result.data);
    return sendSuccess(reply, { userId }, 201);
  } catch (err: any) {
    if (err.message === 'EMAIL_ALREADY_EXISTS') {
      return sendError(reply, 'EMAIL_ALREADY_EXISTS', 400);
    }
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Login
fastify.post('/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = LoginSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const user = await authService.login(result.data);
    const token = fastify.jwt.sign({ sub: user.id, roles: user.roles });
    return sendSuccess(reply, { access_token: token });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return sendError(reply, 'INVALID_CREDENTIALS', 401);
    }
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Refresh Token
fastify.post('/v1/auth/refresh', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = request.user as any;
    const newToken = fastify.jwt.sign({ sub: user.sub, roles: user.roles });
    return sendSuccess(reply, { access_token: newToken });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Auth service listening on port ${port}`);
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
