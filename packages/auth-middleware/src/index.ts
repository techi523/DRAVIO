import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import "@fastify/jwt";

export const authMiddleware = async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Use this for role-based access
  fastify.decorate('authorize', (requiredRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const user = request.user as { sub: string; roles: string[] };
        
        const hasRole = requiredRoles.some(role => user.roles.includes(role));
        if (!hasRole) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
        }
      } catch (err) {
        reply.send(err);
      }
    };
  });
};

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    authorize(requiredRoles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
