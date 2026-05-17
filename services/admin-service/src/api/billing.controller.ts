import { FastifyInstance } from 'fastify';
import { requireRoles } from '../middleware/rbac.js';
import { ActionDispatcher } from '../actions/action-dispatcher.js';

export default async function billingRoutes(fastify: FastifyInstance, opts: any) {
  const dispatcher: ActionDispatcher = opts.dispatcher;

  fastify.post('/wallet/:id/freeze', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'BILLING_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'wallet', targetId: id, action: 'freeze', adminId: 'system-admin' });
    return { success: true, message: `Wallet ${id} frozen` };
  });

  fastify.post('/transaction/:id/reverse', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'BILLING_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'transaction', targetId: id, action: 'reverse', adminId: 'system-admin' });
    return { success: true, message: `Transaction ${id} reversed` };
  });

  fastify.post('/session/:id/pause-billing', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'BILLING_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'session', targetId: id, action: 'pause_billing', adminId: 'system-admin' });
    return { success: true, message: `Billing paused for session ${id}` };
  });
}
