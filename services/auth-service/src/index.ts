import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { RegisterSchema, LoginSchema } from './schema/auth.schema.js';
import { authService } from './services/auth.service.js';
import { sendSuccess, sendError } from './utils/response.js';
// Initialize Firebase Admin SDK at startup (validates env vars immediately)
import './utils/firebase-admin.js';

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

  // Firebase Admin SDK env var guard — validated at import above,
  // but we double-check here to produce a clear startup error message.
  const requiredFirebaseVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const missingFirebase = requiredFirebaseVars.filter(v => !process.env[v]);
  if (missingFirebase.length > 0) {
    throw new Error(
      `FATAL: Missing Firebase Admin SDK environment variables: ${missingFirebase.join(', ')}. ` +
      'Set these in Railway Dashboard → Service → Variables (see .env.production.template).'
    );
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
    const { userId, role } = await authService.register(result.data);
    const primaryRole = role.toLowerCase() as 'buyer' | 'seller' | 'admin';
    const token = fastify.jwt.sign({ sub: userId, roles: [role], role: primaryRole });
    return sendSuccess(reply, {
      token,
      access_token: token,
      user: {
        id: userId,
        email: result.data.email,
        role: primaryRole,
      },
    }, 201);
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
    const primaryRole = (user.roles?.[0] || 'BUYER').toLowerCase() as 'buyer' | 'seller' | 'admin';
    const token = fastify.jwt.sign({ sub: user.id, roles: user.roles, role: primaryRole });
    return sendSuccess(reply, {
      token,
      access_token: token,
      user: { id: user.id, email: user.email, role: primaryRole },
    });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') return sendError(reply, 'INVALID_CREDENTIALS', 401);
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// OAuth Login
import { OAuthLoginSchema, OtpSendSchema, OtpVerifySchema } from './schema/auth.schema.js';
import { otpService } from './services/otp.service.js';

fastify.post('/v1/auth/oauth', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = OAuthLoginSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const user = await authService.oauthLogin(result.data);
    const primaryRole = (user.roles?.[0] || 'BUYER').toLowerCase() as 'buyer' | 'seller' | 'admin';
    const token = fastify.jwt.sign({ sub: user.id, roles: user.roles, role: primaryRole });
    return sendSuccess(reply, {
      token,
      access_token: token,
      user: { id: user.id, email: user.email, role: primaryRole },
    });
  } catch (err: any) {
    fastify.log.error(err);
    if (['INVALID_OAUTH_PAYLOAD', 'EMAIL_REQUIRED_FOR_NEW_OAUTH_ACCOUNT'].includes(err.message)) {
      return sendError(reply, err.message, 400);
    }
    return sendError(reply, 'OAUTH_VERIFICATION_FAILED', 401);
  }
});

// Send OTP
fastify.post('/v1/auth/otp/send', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = OtpSendSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    await otpService.sendOtp(result.data.phone_number);
    return sendSuccess(reply, { message: 'OTP sent successfully' });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'OTP_SEND_FAILED', 500);
  }
});

// Verify OTP
fastify.post('/v1/auth/otp/verify', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = OtpVerifySchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const isValid = await otpService.verifyOtp(result.data.phone_number, result.data.code);
    if (!isValid) {
      return sendError(reply, 'INVALID_OTP', 401);
    }

    const user = await authService.otpLogin(result.data.phone_number, result.data.role_preference);
    const primaryRole = (user.roles?.[0] || 'BUYER').toLowerCase() as 'buyer' | 'seller' | 'admin';
    const token = fastify.jwt.sign({ sub: user.id, roles: user.roles, role: primaryRole });
    return sendSuccess(reply, {
      token,
      access_token: token,
      user: { id: user.id, email: user.email, role: primaryRole, phone: result.data.phone_number },
    });
  } catch (err: any) {
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
