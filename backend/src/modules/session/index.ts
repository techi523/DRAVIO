import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../../db/redis.js';
import { sendEvent } from '../../events/kafka.js';
import { canAccessSession, isAdminUser, buildVpnConfigFromSeller } from './access.js';

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

function isAdmin(request: FastifyRequest): boolean {
  const user = request.user as { sub: string; roles?: string[] } | undefined;
  return isAdminUser(user?.roles);
}

function signedInUserId(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}

async function resolveSellerRelay(sellerId: string) {
  const { marketplaceRepository } = await import('../marketplace/repositories/marketplace.repository.js');
  const seller = await marketplaceRepository.findById(sellerId);
  if (!seller) {
    const err = new Error('SELLER_LISTING_UNAVAILABLE') as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }
  return seller;
}

export function registerSessionRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/sessions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // buyer_id is derived from the token — never from the request body.
    const { seller_id, region } = request.body as any;
    const buyer_id = signedInUserId(request);

    if (!seller_id || typeof seller_id !== 'string') {
      return reply.status(400).send({ error: 'SELLER_REQUIRED' });
    }

    let seller;
    try {
      seller = await resolveSellerRelay(seller_id);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }

    const sessionId = uuidv4();
    const session: Session = {
      session_id: sessionId,
      buyer_id,
      seller_id,
      status: 'ACTIVE',
      start_time: new Date().toISOString(),
      relay_id: seller.relay_public_key ? `relay:${seller.relay_public_key.slice(0, 12)}` : seller_id,
      region: region || 'Africa',
    };

    const vpnConfig = buildVpnConfigFromSeller(seller);

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
      vpn_config: vpnConfig,
    });
  });

  fastify.post('/v1/sessions/:id/handoff', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { new_seller_id } = request.body as any;
    const callerId = signedInUserId(request);

    const redis = getRedis();
    if (!redis) {
      return reply.status(503).send({ error: 'REDIS_UNAVAILABLE' });
    }

    const sessionData = await redis.get(`session:${id}`);
    if (!sessionData) {
      return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
    }

    const session: Session = JSON.parse(sessionData);
    // Only the owning buyer (or an admin) may hand off a session.
    const callerRoles = (request.user as { roles?: string[] } | undefined)?.roles;
    if (!canAccessSession(session, callerId, callerRoles)) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    if (!new_seller_id || typeof new_seller_id !== 'string') {
      return reply.status(400).send({ error: 'NEW_SELLER_REQUIRED' });
    }

    let newSeller;
    try {
      newSeller = await resolveSellerRelay(new_seller_id);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
    if (!newSeller.relay_endpoint || !newSeller.relay_public_key) {
      return reply.status(409).send({ error: 'SELLER_RELAY_NOT_REGISTERED' });
    }

    session.seller_id = new_seller_id;
    await redis.set(`session:${id}`, JSON.stringify(session), 'EX', SESSION_TTL);

    return { success: true, new_seller_id, handoff_time: new Date().toISOString() };
  });

  // Global active-session view is operator-only. Regular users use the
  // authenticated/self-scoped billing session endpoints instead.
  fastify.get('/v1/sessions/active', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAdmin(request)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin access required' });
    }

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

    return { sessions };
  });

  fastify.post('/v1/sessions/:id/end', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const callerId = signedInUserId(request);

    const redis = getRedis();
    if (!redis) {
      return reply.status(503).send({ error: 'REDIS_UNAVAILABLE' });
    }

    const sessionData = await redis.get(`session:${id}`);
    if (!sessionData) {
      return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
    }

    const session: Session = JSON.parse(sessionData);
    const callerRoles = (request.user as { roles?: string[] } | undefined)?.roles;
    if (!canAccessSession(session, callerId, callerRoles)) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    session.status = 'COMPLETED';
    await redis.set(`session:${id}`, JSON.stringify(session), 'EX', SESSION_TTL);

    return { success: true, status: 'COMPLETED' };
  });
}

/**
 * Creates an ACTIVE connectivity session and returns a WireGuard config built
 * from the seller's real registered relay. Throws:
 *  - SELLER_LISTING_UNAVAILABLE (409) when the seller has no active listing
 *  - SELLER_RELAY_NOT_REGISTERED (409) when the seller has no live relay
 */
export async function createVpnSession(buyerId: string, sellerId: string, region?: string): Promise<{ session_id: string; vpn_config: string }> {
  const seller = await resolveSellerRelay(sellerId);

  const sessionId = uuidv4();
  const session: Session = {
    session_id: sessionId,
    buyer_id: buyerId,
    seller_id: sellerId,
    status: 'ACTIVE',
    start_time: new Date().toISOString(),
    relay_id: seller.relay_public_key ? `relay:${seller.relay_public_key.slice(0, 12)}` : sellerId,
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

  const vpnConfig = buildVpnConfigFromSeller(seller);

  return { session_id: sessionId, vpn_config: vpnConfig };
}