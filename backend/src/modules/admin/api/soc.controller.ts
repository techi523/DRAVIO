import { FastifyInstance } from 'fastify';
import { requireRoles } from '../middleware/rbac.js';
import { ActionDispatcher } from '../actions/action-dispatcher.js';

export default async function socRoutes(fastify: FastifyInstance, opts: any) {
  const dispatcher: ActionDispatcher = opts.dispatcher;

  fastify.post('/lockdown', {
    preHandler: [requireRoles(['SUPER_ADMIN'])]
  }, async (req: any, reply) => {
    fastify.log.warn('🚨 EMERGENCY LOCKDOWN TRIGGERED');
    await dispatcher.dispatch({ targetType: 'system', targetId: 'global', action: 'lockdown', adminId: 'system-admin' });
    return { success: true, message: 'Global lockdown initiated' };
  });

  fastify.post('/revoke-tokens', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { userId } = req.body;
    await dispatcher.dispatch({ targetType: 'user', targetId: userId, action: 'revoke_tokens', adminId: 'system-admin' });
    return { success: true, message: `Tokens revoked for user ${userId}` };
  });
  
  fastify.post('/incident/create', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_AGENT'])]
  }, async (req: any, reply) => {
    const incident = req.body;
    await dispatcher.dispatch({ targetType: 'incident', targetId: 'new', action: 'create', payload: incident, adminId: 'system-admin' });
    return { success: true, message: 'Incident logged successfully' };
  });
}
