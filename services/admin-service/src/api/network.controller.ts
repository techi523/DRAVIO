import { FastifyInstance } from 'fastify';
import { requireRoles } from '../middleware/rbac.js';
import { ActionDispatcher } from '../actions/action-dispatcher.js';

export default async function networkRoutes(fastify: FastifyInstance, opts: any) {
  const dispatcher: ActionDispatcher = opts.dispatcher;

  fastify.post('/node/:id/restart', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'NETWORK_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'vpn_node', targetId: id, action: 'restart', adminId: 'system-admin' });
    return { success: true, message: `Node ${id} restart initiated` };
  });

  fastify.post('/session/:id/terminate', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'NETWORK_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    await dispatcher.dispatch({ targetType: 'session', targetId: id, action: 'terminate', adminId: 'system-admin' });
    return { success: true, message: `Session ${id} terminated` };
  });

  fastify.post('/ip/block', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'NETWORK_ADMIN', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { ip } = req.body;
    await dispatcher.dispatch({ targetType: 'network', targetId: 'global', action: 'block_ip', payload: { ip }, adminId: 'system-admin' });
    return { success: true, message: `IP ${ip} blocked globally` };
  });
}
