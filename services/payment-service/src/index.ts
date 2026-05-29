import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { InitiatePaymentSchema, WebhookSchema } from './schema/payment.schema.js';
import { paymentService } from './services/payment.service.js';
import { sendSuccess, sendError } from './utils/response.js';

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          remoteAddress: request.ip,
        };
      },
    },
  } 
});

async function init() {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.');
  }

  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });
  await fastify.register(authMiddleware);
}

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'payment-service' }));

// Initiate a payment
fastify.post('/v1/payments/initiate', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const result = InitiatePaymentSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  const userId = (request.user as any).sub;

  try {
    const payment = await paymentService.initiatePayment(userId, result.data);
    return sendSuccess(reply, payment, 201);
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// Stripe Webhook (with signature verification)
fastify.post('/v1/payments/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = WebhookSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  const { event, provider_ref } = result.data;
  
  try {
    const transaction = await paymentService.handleWebhook(provider_ref, event);
    if (!transaction && event === 'payment_intent.succeeded') {
      return sendError(reply, 'TRANSACTION_NOT_FOUND', 404);
    }
    return sendSuccess(reply, { received: true });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// M-Pesa Daraja API Callback
fastify.post('/v1/payments/mpesa/callback', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await paymentService.handleMpesaCallback(request.body);
    return sendSuccess(reply, result);
  } catch (err: any) {
    fastify.log.error(err);
    // Always return 200 to M-Pesa to prevent retries on our processing errors
    return sendSuccess(reply, { received: true });
  }
});

// Check payment status (used by frontend polling)
fastify.get('/v1/payments/:id/status', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  try {
    const { paymentRepository } = await import('./repositories/payment.repository.js');
    const transaction = await paymentRepository.findById(id);
    if (!transaction) {
      return sendError(reply, 'PAYMENT_NOT_FOUND', 404);
    }
    return sendSuccess(reply, {
      payment_id: transaction.id,
      status: transaction.status,
      amount_usd: transaction.amount_usd,
      provider_ref: transaction.provider_ref,
    });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3004');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Payment service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

async function bootstrap() {
  await init();
  await start();
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
