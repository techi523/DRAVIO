import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import "@fastify/jwt";

export const authMiddleware = async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply, requiredRoles?: string[]) => {
    try {
      await request.jwtVerify();
      const user = request.user as { id: string; role: string };
      
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
      }
    } catch (err) {
      reply.send(err);
    }
  });
};

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply, requiredRoles?: string[]): Promise<void>;
  }
}
