import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../../db/redis.js';
import { sendEvent } from '../../events/kafka.js';

interface Session {
  session_id: string;
  buyer_id: string;
  seller_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
  start_time: string;
  relay_id: string;
  vpn_config?: string;
  region?: string;
}

const SESSION_TTL = 24 * 60 * 60;

export function registerSessionRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({ status: 'ok', service: 'session-service' }));

  fastify.post('/v1/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { buyer_id, seller_id, region } = request.body as any;

    const sessionId = uuidv4();
    const session: Session = {
      session_id: sessionId,
      buyer_id,
      seller_id,
      status: 'ACTIVE',
      start_time: new Date().toISOString(),
      relay_id: 'relay-default',
      region: region || 'Africa',
    };

    const redis = getRedis();
    if (redis) {
      await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL);
    }

    await sendEvent('dm.session.started', sessionId, {
      session_id: sessionId,
      buyer_id,
      seller_id,
      status: 'STARTED',
      relay_id: session.relay_id,
    });

    return reply.code(201).send({
      session_id: sessionId,
      status: 'active',
      relay: session.region,
      vpn_config: `[Interface]\nPrivateKey = [generated]\nAddress = 10.42.1.5/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = [relay-public-key]\nEndpoint = relay:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25`,
    });
  });

  fastify.post('/v1/sessions/:id/handoff', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { new_seller_id } = request.body as any;

    const redis = getRedis();
    if (!redis) {
      return reply.status(503).send({ error: 'REDIS_UNAVAILABLE' });
    }

    const sessionData = await redis.get(`session:${id}`);
    if (!sessionData) {
      return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
    }

    const session: Session = JSON.parse(sessionData);
    session.seller_id = new_seller_id;
    await redis.set(`session:${id}`, JSON.stringify(session), 'EX', SESSION_TTL);

    return { success: true, new_seller_id, handoff_time: new Date().toISOString() };
  });

  fastify.get('/v1/sessions/active', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const redis = getRedis();
    if (!redis) {
      return { sessions: [] };
    }

    const keys = await redis.keys('session:*');
    const sessions: Session[] = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const session: Session = JSON.parse(data);
        if (session.status === 'ACTIVE') {
          sessions.push(session);
        }
      }
    }

    return sessions;
  });

  fastify.post('/v1/sessions/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    const redis = getRedis();
    if (!redis) {
      return reply.status(503).send({ error: 'REDIS_UNAVAILABLE' });
    }

    const sessionData = await redis.get(`session:${id}`);
    if (!sessionData) {
      return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
    }

    const session: Session = JSON.parse(sessionData);
    session.status = 'COMPLETED';
    await redis.set(`session:${id}`, JSON.stringify(session), 'EX', SESSION_TTL);

    return { success: true, status: 'COMPLETED' };
  });
}

export async function createVpnSession(buyerId: string, sellerId: string, region?: string): Promise<{ session_id: string; vpn_config: string }> {
  const sessionId = uuidv4();
  const session: Session = {
    session_id: sessionId,
    buyer_id: buyerId,
    seller_id: sellerId,
    status: 'ACTIVE',
    start_time: new Date().toISOString(),
    relay_id: 'relay-default',
    region: region || 'auto',
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL);
  }

  await sendEvent('dm.session.started', sessionId, {
    session_id: sessionId,
    buyer_id: buyerId,
    seller_id: sellerId,
    status: 'STARTED',
  });

  const vpnConfig = `[Interface]\nPrivateKey = [generated]\nAddress = 10.42.1.5/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = [relay-public-key]\nEndpoint = relay:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25`;

  return { session_id: sessionId, vpn_config: vpnConfig };
}
