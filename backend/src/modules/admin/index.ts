import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { Kafka } from 'kafkajs';
import { ruleEngine } from './engines/rule-engine.js';
import { requireRoles } from './middleware/rbac.js';
import { ActionDispatcher } from './actions/action-dispatcher.js';
import userRoutes from './api/users.controller.js';
import billingRoutes from './api/billing.controller.js';
import networkRoutes from './api/network.controller.js';
import socRoutes from './api/soc.controller.js';
import rulesRoutes from './api/rules.controller.js';
import { pool } from '../../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const kafka = new Kafka({
  clientId: 'admin-service',
  brokers: [process.env.KAFKA_URL || 'localhost:29092']
});

let _actionDispatcher: ActionDispatcher | null = null;

function getActionDispatcher(): ActionDispatcher {
  if (!_actionDispatcher) {
    _actionDispatcher = new ActionDispatcher(kafka);
  }
  return _actionDispatcher;
}

export async function registerAdminRoutes(fastify: FastifyInstance, io: SocketIOServer) {
  const actionDispatcher = getActionDispatcher();
  ruleEngine.setDispatcher(actionDispatcher);

  fastify.get('/admin/telemetry', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SUPPORT_AGENT', 'SECURITY_ADMIN'])]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM billing.sessions WHERE status = 'ACTIVE'`
      );
      const activeSessions = parseInt(result.rows[0]?.count || '0', 10);

      return reply.send({
        active_nodes: activeSessions,
        active_tunnels: activeSessions,
        total_bandwidth_gb: activeSessions * 0.25,
        lockdown_active: (global as any).__dravio_lockdown__ ?? false,
      });
    } catch (err: any) {
      fastify.log.error({ err }, '[admin/telemetry]');
      return reply.send({ active_nodes: 0, active_tunnels: 0, total_bandwidth_gb: 0, lockdown_active: false });
    }
  });

  fastify.get('/admin/incidents', {
    preHandler: [requireRoles(['SUPER_ADMIN', 'SECURITY_ADMIN'])]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await pool.query(
        `SELECT id, action AS description, actor_id, service, resource_type,
                created_at, 'info' AS severity
           FROM audit.audit_log
          ORDER BY created_at DESC
          LIMIT 50`
      );
      return reply.send(result.rows);
    } catch (err: any) {
      fastify.log.error({ err }, '[admin/incidents]');
      return reply.send([]);
    }
  });

  fastify.post('/admin/lockdown', {
    preHandler: [requireRoles(['SUPER_ADMIN'])]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { active } = req.body as any;
    const adminId = (req as any).user?.sub || 'unknown';

    (global as any).__dravio_lockdown__ = active;

    try {
      const producer = kafka.producer();
      await producer.connect();
      await producer.send({
        topic: 'dm.admin.lockdown',
        messages: [{
          value: JSON.stringify({ active, adminId, timestamp: new Date().toISOString() })
        }]
      });
      await producer.disconnect();
    } catch (_e) {
      fastify.log.warn('Could not propagate lockdown via Kafka');
    }

    fastify.log.warn(`[LOCKDOWN] ${active ? 'ENGAGED' : 'LIFTED'} by admin ${adminId}`);
    return reply.send({ active, timestamp: new Date().toISOString() });
  });

  await fastify.register(userRoutes, { prefix: '/v1/admin/users', dispatcher: actionDispatcher });
  await fastify.register(billingRoutes, { prefix: '/v1/admin/billing', dispatcher: actionDispatcher });
  await fastify.register(networkRoutes, { prefix: '/v1/admin/network', dispatcher: actionDispatcher });
  await fastify.register(socRoutes, { prefix: '/v1/admin/soc', dispatcher: actionDispatcher });
  await fastify.register(rulesRoutes, { prefix: '/v1/admin/rules' });

  fastify.post('/v1/admin/actions/:targetType/:targetId/:actionName', {
      preHandler: [requireRoles(['SUPER_ADMIN', 'SUPPORT_AGENT', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { targetType, targetId, actionName } = req.params;
    const payload = req.body;
    const adminId = req.user?.sub || 'unknown';

    const result = await actionDispatcher.dispatch({ targetType, targetId, action: actionName, payload, adminId });
    return result;
  });

  if (!process.env.KAFKA_URL) {
    fastify.log.warn('[Admin] KAFKA_URL not set — Admin Service entering autonomous mode (no live telemetry relay).');
    return;
  }

  try {
    await actionDispatcher.connect();
    const consumer = kafka.consumer({ groupId: 'admin-service-group' });
    await consumer.connect();

    await consumer.subscribe({ topic: 'dm.security.alert', fromBeginning: false });
    await consumer.subscribe({ topic: 'dm.billing.transaction', fromBeginning: false });
    await consumer.subscribe({ topic: 'dm.vpn.telemetry', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (message.value) {
          const event = JSON.parse(message.value.toString());

          switch (topic) {
            case 'dm.security.alert':
              fastify.log.info(`Relaying Security Alert: ${event.type}`);
              io.emit('security_alert', event);
              ruleEngine.evaluate({ type: 'threat', value: event.threatScore || 100, context: event });
              break;
            case 'dm.billing.transaction':
              io.emit('billing_update', event);
              break;
            case 'dm.vpn.telemetry':
              io.emit('vpn_telemetry', event);
              ruleEngine.evaluate({ type: 'traffic', value: event.bytesIn + event.bytesOut, context: event });
              break;
          }
        }
      },
    });
  } catch (err) {
    fastify.log.warn('Kafka core offline. Admin Service entering autonomous mode.');
  }
}

export { getActionDispatcher };