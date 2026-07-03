import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateProfileSchema } from './schema/user.schema.js';
import { userRepository } from './repositories/user.repository.js';
import { sendSuccess, sendError } from './utils/response.js';

export async function registerUserRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({ status: 'ok', service: 'user-service' }));

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
    const updates = request.body as any;

    try {
      const profile = await userRepository.findByAuthId(authUserId);
      if (!profile) {
        return sendError(reply, 'PROFILE_NOT_FOUND', 404);
      }

      const updatedProfile = await userRepository.update(profile.id, updates);
      return sendSuccess(reply, { profile: updatedProfile });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}
