import { FastifyInstance } from 'fastify';
import { requireRoles } from '../middleware/rbac.js';
import { ruleEngine } from '../engines/rule-engine.js';

export default async function rulesRoutes(fastify: FastifyInstance, opts: any) {
  
  fastify.get('/', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN', 'NETWORK_ADMIN'])]
  }, async (req: any, reply) => {
    return { success: true, data: ruleEngine.rules };
  });

  fastify.post('/:id/toggle', {
    preHandler: [requireRoles(['SUPER_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    const rule = ruleEngine.rules.find((r: any) => r.id === id);
    if (rule) {
        rule.active = !rule.active;
        return { success: true, active: rule.active, message: `Rule ${id} toggled to ${rule.active}` };
    }
    return { success: false, message: 'Rule not found' };
  });

  fastify.post('/create', {
    preHandler: [requireRoles(['SUPER_ADMIN'])]
  }, async (req: any, reply) => {
    const rule = req.body;
    // Basic validation
    if (!rule.id || !rule.type || !rule.condition || !rule.action) {
      return reply.code(400).send({ success: false, message: 'Invalid rule format' });
    }
    ruleEngine.rules.push({ ...rule, active: true });
    return { success: true, message: 'Rule created successfully', data: rule };
  });

  fastify.delete('/:id', {
    preHandler: [requireRoles(['SUPER_ADMIN'])]
  }, async (req: any, reply) => {
    const { id } = req.params;
    const initialLength = ruleEngine.rules.length;
    ruleEngine.rules = ruleEngine.rules.filter((r: any) => r.id !== id);
    if (ruleEngine.rules.length < initialLength) {
      return { success: true, message: `Rule ${id} deleted` };
    }
    return { success: false, message: 'Rule not found' };
  });
}
