import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InitiatePaymentSchema, WebhookSchema } from './schema/payment.schema.js';
import { paymentService } from './services/payment.service.js';
import { sendSuccess, sendError } from './utils/response.js';

export async function registerPaymentRoutes(fastify: FastifyInstance) {
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

  fastify.post('/v1/payments/mpesa/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await paymentService.handleMpesaCallback(request.body);
      return sendSuccess(reply, result);
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, { received: true });
    }
  });

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

  fastify.post('/v1/payments/wallet/deduct', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, amount, reason } = request.body as any;

    if (!userId || !amount || typeof amount !== 'number' || amount <= 0) {
      return sendError(reply, 'INVALID_DEDUCTION_PARAMS', 400);
    }

    try {
      const { walletRepository } = await import('./repositories/wallet.deduct.js');
      const result = await walletRepository.deductBalance(userId, amount);
      return sendSuccess(reply, {
        userId,
        deducted: amount,
        balance: result.new_balance,
        reason: reason || 'Usage charge',
      });
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        return sendSuccess(reply, { balance: 0, depleted: true });
      }
      fastify.log.error('[wallet/deduct]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}
