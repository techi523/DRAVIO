import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpdateProfileSchema } from './schema/user.schema.js';
import { userRepository } from './repositories/user.repository.js';
import { sendSuccess, sendError } from './utils/response.js';
import { pool } from '../../db/client.js';

export async function registerUserRoutes(fastify: FastifyInstance) {
  // NOTE: There is intentionally NO public POST /v1/users.
  // Profiles are created automatically server-side during registration,
  // OAuth and OTP login (see auth/service.ts). An anonymous profile-write
  // endpoint would allow attaching profiles to arbitrary accounts.

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

  fastify.put('/v1/users/me', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authUserId = (request.user as any).sub;
    const result = UpdateProfileSchema.safeParse(request.body);
    if (!result.success) {
      return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
    }

    try {
      const profile = await userRepository.findByAuthId(authUserId);
      if (!profile) {
        return sendError(reply, 'PROFILE_NOT_FOUND', 404);
      }

      const updatedProfile = await userRepository.update(profile.id, result.data);
      if (!updatedProfile) {
        return sendError(reply, 'NO_FIELDS_TO_UPDATE', 400);
      }
      return sendSuccess(reply, { profile: updatedProfile });
    } catch (err: any) {
      fastify.log.error(err);
      if (err.message === 'NO_FIELDS_TO_UPDATE') {
        return sendError(reply, 'NO_FIELDS_TO_UPDATE', 400);
      }
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/users/me/stats', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authUserId = (request.user as any).sub;
    try {
      // Real numbers only. rating/uptime_pct are null because no rating schema
      // or uptime history exists — the app must show an honest unknown state.
      const earnings = await pool.query(
        `SELECT COUNT(*)::int AS total_sales,
                COALESCE(SUM(amount_usd), 0)::float AS total_sales_usd
           FROM billing.seller_earnings
          WHERE seller_id = $1 AND status = 'SETTLED'`,
        [authUserId]
      );
      const sessions = await pool.query(
        `SELECT COUNT(*)::int AS total_sessions
           FROM billing.sessions
          WHERE customer_id = $1 AND status <> 'ACTIVE'`,
        [authUserId]
      );
      const profile = await pool.query(
        'SELECT is_seller FROM users.profiles WHERE auth_user_id = $1',
        [authUserId]
      );

      return sendSuccess(reply, {
        rating: null,
        uptime_pct: null,
        total_sales: earnings.rows[0]?.total_sales ?? 0,
        total_sales_usd: earnings.rows[0]?.total_sales_usd ?? 0,
        total_sessions: sessions.rows[0]?.total_sessions ?? 0,
        is_seller: profile.rows[0]?.is_seller ?? false,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}