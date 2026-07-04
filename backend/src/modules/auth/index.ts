import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RegisterSchema, LoginSchema, OAuthLoginSchema, OtpSendSchema, OtpVerifySchema } from './schema/auth.schema.js';
import { authService } from './services/auth.service.js';
import { otpService } from './services/otp.service.js';
import { sendSuccess, sendError } from './utils/response.js';
import { getFirebaseAuth } from './utils/firebase-admin.js';

export async function registerAuthRoutes(fastify: FastifyInstance) {
  getFirebaseAuth();

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
}
