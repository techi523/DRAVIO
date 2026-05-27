import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { authMiddleware } from '@dravio/auth-middleware';
import axios from 'axios';
import { Kafka } from 'kafkajs';
import { ruleEngine } from './engines/rule-engine.js';
import { requireRoles } from './middleware/rbac.js';
import { ActionDispatcher } from './actions/action-dispatcher.js';

const fastify: FastifyInstance = Fastify({ 
  logger: { level: 'info' } 
});

// Internal Service URLs
const SERVICES = {
  session: 'http://session-service:3005',
  user: 'http://user-service:3002',
  billing: 'http://billing-service:3006',
  marketplace: 'http://marketplace-service:3000'
};

const kafka = new Kafka({
  clientId: 'admin-service',
  brokers: [process.env.KAFKA_URL || 'localhost:29092']
});

const consumer = kafka.consumer({ groupId: 'admin-service-group' });
const actionDispatcher = new ActionDispatcher(kafka);
ruleEngine.setDispatcher(actionDispatcher);

async function init() {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.');
  }

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });
  await fastify.register(authMiddleware);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'admin-service' }));

  // ─── ADMIN ACTIONS (Modularized) ───

  fastify.register(import('./api/users.controller.js'), { prefix: '/v1/admin/users', dispatcher: actionDispatcher });
  fastify.register(import('./api/billing.controller.js'), { prefix: '/v1/admin/billing', dispatcher: actionDispatcher });
  fastify.register(import('./api/network.controller.js'), { prefix: '/v1/admin/network', dispatcher: actionDispatcher });
  fastify.register(import('./api/soc.controller.js'), { prefix: '/v1/admin/soc', dispatcher: actionDispatcher });
  fastify.register(import('./api/rules.controller.js'), { prefix: '/v1/admin/rules' });

  // Universal Action Dispatcher (Legacy fallback if needed, but best to keep it for dynamic UI actions)
  fastify.post('/v1/admin/actions/:targetType/:targetId/:actionName', {
      preHandler: [requireRoles(['SUPER_ADMIN', 'SUPPORT_AGENT', 'SECURITY_ADMIN'])]
  }, async (req: any, reply) => {
    const { targetType, targetId, actionName } = req.params;
    const payload = req.body;
    
    const adminId = req.user?.sub || 'unknown';
    
    const result = await actionDispatcher.dispatch({
        targetType,
        targetId,
        action: actionName,
        payload,
        adminId
    });

    return result;
  });
}

const start = async (io: SocketIOServer) => {
  try {
    await actionDispatcher.connect();
    await consumer.connect();
    
    // Subscribe to multiple ecosystem topics
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
    fastify.log.warn('Kafka core offline or electing leader. Admin Service entering autonomous mode.');
  }
};

const runServer = async () => {
  try {
    await init();
    const port = 3008;
    await fastify.listen({ port, host: '::' });

    const io = new SocketIOServer(fastify.server, {
      cors: { origin: '*' }
    });

    io.on('connection', (socket) => {
      fastify.log.info(`Admin connected: ${socket.id}`);
      // Real system health will be pushed via Kafka events from each service
    });

    start(io); // Start Kafka consumer — provides real-time telemetry

    fastify.log.info(`Admin Control Service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

runServer();
