import { FastifyInstance } from 'fastify';
import { requireRoles } from '../middleware/rbac.js';
import { ActionDispatcher } from '../actions/action-dispatcher.js';

export default async function userRoutes(fastify: FastifyInstance, opts: any) {
  const dispatcher: ActionDispatcher = opts.dispatcher;

  fastify.post('/:id/suspend', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'user', targetId: id, action: 'suspend', adminId: 'system-admin' });
    return { success: true, message: `User ${id} suspended` };
  });

  fastify.post('/:id/ban', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'user', targetId: id, action: 'ban', adminId: 'system-admin' });
    return { success: true, message: `User ${id} banned` };
  });

  fastify.post('/:id/logout', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SUPPORT_AGENT'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'user', targetId: id, action: 'force_logout', adminId: 'system-admin' });
    return { success: true, message: `User ${id} forced logout` };
  });
  
  fastify.post('/seller/:id/pause-listing', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SUPPORT_AGENT'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'seller', targetId: id, action: 'pause_listing', adminId: 'system-admin' });
    return { success: true, message: `Seller ${id} listing paused` };
  });
}
