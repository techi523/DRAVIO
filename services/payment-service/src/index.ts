import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { pool } from './db/client.js';

const fastify: FastifyInstance = Fastify({ logger: true });

await fastify.register(cors);
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});
await fastify.register(authMiddleware);

fastify.get('/health', async () => {
  return { status: 'ok', service: 'payment-service' };
});

// Initiate a payment (Buyer App -> Gateway -> Payment Service)
fastify.post('/v1/payments/initiate', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const { amount_usd, currency, method, session_id } = request.body as any;
  const userId = (request.user as any).sub;

  try {
    // 1. Log transaction as PENDING in local DB
    const result = await pool.query(
      'INSERT INTO payments.transactions (session_id, user_id, amount_usd, currency, payment_method, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [session_id, userId, amount_usd, currency || 'USD', method, 'PENDING']
    );
    const transactionId = result.rows[0].id;

    // 2. Mocking Stripe/M-Pesa payment intent creation
    // const intent = await stripe.paymentIntents.create({ amount: amount_usd * 100, ... });
    const providerRef = `mock_intent_${Date.now()}`;
    
    await pool.query('UPDATE payments.transactions SET provider_ref = $1 WHERE id = $2', [providerRef, transactionId]);

    return { 
      success: true, 
      payment_id: transactionId, 
      provider_ref: providerRef,
      checkout_url: `https://checkout.dravio.com/${providerRef}` 
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ success: false, error: 'PAYMENT_INITIATION_FAILED' });
  }
});

// Webhook for payment confirmation
fastify.post('/v1/payments/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
  const { event, provider_ref } = request.body as any;
  
  if (event === 'payment_intent.succeeded') {
    await pool.query(
      'UPDATE payments.transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE provider_ref = $2',
      ['COMPLETED', provider_ref]
    );
    
    // TODO: Emit Kafka event dm.payment.completed
    fastify.log.info(`Payment completed for ref: ${provider_ref}`);
  }

  return { received: true };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3004, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
