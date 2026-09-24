import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

export async function buildTestApp(
  guard: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(jwt, { secret: 'test-secret-key-that-is-at-least-32-chars-long!!' });

  app.get('/admin/x', { preHandler: [guard] }, async () => ({ ok: true }));

  return app;
}