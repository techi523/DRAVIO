import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'crypto';
import { RegisterSchema, LoginSchema, OAuthLoginSchema, OtpSendSchema, OtpVerifySchema } from './schema/auth.schema.js';
import { authService } from './services/auth.service.js';
import { otpService } from './services/otp.service.js';
import { authRepository } from './repositories/auth.repository.js';
import { sendSuccess, sendError } from './utils/response.js';
import { getFirebaseAuth } from './utils/firebase-admin.js';
import { emitAudit } from '../audit/producer.js';

const ACCESS_TTL = parseInt(process.env.JWT_ACCESS_TTL || '900', 10);
const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL || '2592000', 10);

function signAccessToken(fastify: FastifyInstance, userId: string, roles: string[]) {
  const primaryRole = (roles?.[0] || 'BUYER').toLowerCase() as 'buyer' | 'seller' | 'admin';
  return fastify.jwt.sign(
    { sub: userId, roles, role: primaryRole },
    { expiresIn: ACCESS_TTL }
  );
}

async function issueSession(fastify: FastifyInstance, userId: string, roles: string[]) {
  const accessToken = signAccessToken(fastify, userId, roles);
  const refreshToken = randomBytes(64).toString('hex');
  await authRepository.createRefreshToken(userId, refreshToken, REFRESH_TTL * 1000);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL };
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  getFirebaseAuth();

  fastify.post('/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = RegisterSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      const { userId, role } = await authService.register(result.data);
      const { accessToken, refreshToken, expiresIn } = await issueSession(fastify, userId, [role]);
      await emitAudit({
        actor_id: userId,
        action: 'auth.register',
        service: 'auth',
        resource_type: 'user',
        resource_id: userId,
        metadata: { role, email: result.data.email, country_code: result.data.country_code },
      });
      return sendSuccess(reply, {
        access_token: accessToken,
        token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user: {
          id: userId,
          email: result.data.email,
          role: role.toLowerCase(),
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

  fastify.post('/v1/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = LoginSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      const user = await authService.login(result.data);
      const { accessToken, refreshToken, expiresIn } = await issueSession(fastify, user.id, user.roles);
      await emitAudit({
        actor_id: user.id,
        action: 'auth.login.success',
        service: 'auth',
        resource_type: 'user',
        resource_id: user.id,
        metadata: { email: user.email },
      });
      return sendSuccess(reply, {
        access_token: accessToken,
        token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user: { id: user.id, email: user.email, role: (user.roles?.[0] || 'BUYER').toLowerCase() },
      });
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        await emitAudit({
          action: 'auth.login.failure',
          service: 'auth',
          resource_type: 'authentication',
          resource_id: result.data.email,
          metadata: { reason: 'INVALID_CREDENTIALS' },
        });
        return sendError(reply, 'INVALID_CREDENTIALS', 401);
      }
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.post('/v1/auth/oauth', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = OAuthLoginSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      const user = await authService.oauthLogin(result.data);
      const { accessToken, refreshToken, expiresIn } = await issueSession(fastify, user.id, user.roles);
      return sendSuccess(reply, {
        access_token: accessToken,
        token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user: { id: user.id, email: user.email, role: (user.roles?.[0] || 'BUYER').toLowerCase() },
      });
    } catch (err: any) {
      fastify.log.error(err);
      if (['INVALID_OAUTH_PAYLOAD', 'EMAIL_REQUIRED_FOR_NEW_OAUTH_ACCOUNT'].includes(err.message)) {
        return sendError(reply, err.message, 400);
      }
      return sendError(reply, 'OAUTH_VERIFICATION_FAILED', 401);
    }
  });

  fastify.post('/v1/auth/otp/send', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = OtpSendSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      await otpService.sendOtp(result.data.phone_number);
      return sendSuccess(reply, { message: 'OTP sent successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      if (err.message?.startsWith('OTP_UNAVAILABLE')) {
        return sendError(reply, err.message, 503);
      }
      return sendError(reply, 'OTP_SEND_FAILED', 500);
    }
  });

  fastify.post('/v1/auth/otp/verify', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      const { accessToken, refreshToken, expiresIn } = await issueSession(fastify, user.id, user.roles);
      return sendSuccess(reply, {
        access_token: accessToken,
        token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        user: { id: user.id, email: user.email, role: (user.roles?.[0] || 'BUYER').toLowerCase(), phone: result.data.phone_number },
      });
    } catch (err: any) {
      fastify.log.error(err);
      if (err.message?.startsWith('OTP_UNAVAILABLE')) {
        return sendError(reply, err.message, 503);
      }
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Token refresh.
  // Preferred: body { refresh_token } -> rotates the refresh token (revoke old, issue new).
  // Legacy fallback: an Authorization: Bearer <valid access token> is re-signed.
  fastify.post('/v1/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { refresh_token?: string } | undefined;
    const providedRefreshToken = body?.refresh_token;

    try {
      if (providedRefreshToken) {
        const record = await authRepository.findRefreshToken(providedRefreshToken);
        if (!record || record.revoked || new Date(record.expires_at).getTime() < Date.now()) {
          return sendError(reply, 'INVALID_REFRESH_TOKEN', 401);
        }
        await authRepository.revokeRefreshToken(providedRefreshToken);
        const { accessToken, refreshToken, expiresIn } = await issueSession(fastify, record.user_id, record.roles);
        return sendSuccess(reply, { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn });
      }

      // Security hardening (A-10): Legacy "re-issue from a live access token"
      // path REMOVED. Re-issuing a session from a valid *access* token means a
      // leaked access token can mint a session indefinitely AND defeats logout
      // (logout only revokes refresh tokens). Clients must present the real
      // refresh token (mobile-app/src/services/api.ts, buyer-web api.ts both
      // already send refresh_token; the legacy path had zero in-repo callers).
      return sendError(reply, 'REFRESH_TOKEN_REQUIRED', 400);
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Logout: revoke the presented refresh token (or all tokens for the user).
  fastify.post('/v1/auth/logout', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    const body = request.body as { refresh_token?: string } | undefined;
    try {
      if (body?.refresh_token) {
        await authRepository.revokeRefreshToken(body.refresh_token);
      } else if (userId) {
        await authRepository.revokeAllUserTokens(userId);
      }
      return sendSuccess(reply, { success: true });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}