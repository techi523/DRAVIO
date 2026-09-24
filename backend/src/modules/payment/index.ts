import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InitiatePaymentSchema, MpesaCallbackBodySchema } from './schema/payment.schema.js';
import { paymentService } from './services/payment.service.js';
import { stripeProvider } from './providers/stripe.provider.js';
import { sendSuccess, sendError } from './utils/response.js';
import { transactionService } from './services/transaction.service.js';

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
      if (err.message === 'POLICY_ACCEPTANCE_REQUIRED') {
        return sendError(reply, 'POLICY_ACCEPTANCE_REQUIRED', 403);
      }
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Stripe webhook — raw-body signature verification is MANDATORY.
  // Hosted in an encapsulated scope so we can override the JSON parser for this route only.
  await fastify.register(async (instance: FastifyInstance) => {
    instance.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    instance.post('/v1/payments/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string | undefined;
      if (!signature) {
        return reply.status(400).send({ error: 'MISSING_STRIPE_SIGNATURE' });
      }

      let event;
      try {
        event = stripeProvider.verifyWebhookSignature(request.body as Buffer, signature);
      } catch (err: any) {
        fastify.log.warn('[Stripe webhook] Signature verification failed:', err.message);
        return reply.status(400).send({ error: 'INVALID_SIGNATURE' });
      }

      try {
        const result = await paymentService.handleVerifiedStripeEvent(event);
        if (result) {
          return reply.status(200).send({ received: true, status: 'processed' });
        }
        // Event acknowledged but not actionable (e.g. non-success event, replay).
        return reply.status(200).send({ received: true, status: 'ignored' });
      } catch (err: any) {
        fastify.log.error('[Stripe webhook] processing error:', err);
        return reply.status(500).send({ error: 'PROCESSING_FAILED' });
      }
    });
  });

  fastify.post('/v1/payments/mpesa/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = MpesaCallbackBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_CALLBACK_PAYLOAD' });
    }

    try {
      const result = await paymentService.handleMpesaCallback(parsed.data);
      // Always acknowledge the callback with 200 once durably handled;
      // re-callbacks are replay-safe (state-machine guarded).
      return reply.status(200).send({ received: true, status: result.status });
    } catch (err: any) {
      fastify.log.error('[M-Pesa callback] processing error:', err);
      // Do NOT silently mark success on internal errors.
      return reply.status(500).send({ error: 'PROCESSING_FAILED' });
    }
  });

  fastify.get('/v1/payments/:id/status', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    try {
      const { paymentRepository } = await import('./repositories/payment.repository.js');
      // Ownership-scoped: a user may only read their own transactions.
      const transaction = await paymentRepository.findOwnedById(id, userId);
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

  // Wallet deduction primitive. Requires authentication and is always scoped
  // to the authenticated user (self-only) — never to an arbitrary body userId.
  fastify.post('/v1/payments/wallet/deduct', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, reason } = request.body as any;
    const userId = (request.user as any).sub;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 100000) {
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

  function handleTransitionError(reply: FastifyReply, err: any) {
    const code = err?.code || '';
    if (err?.message === 'TRANSACTION_NOT_FOUND') {
      return sendError(reply, 'TRANSACTION_NOT_FOUND', 404);
    }
    if (code === 'FORBIDDEN_ROLE' || code === 'OWNERSHIP_REQUIRED') {
      return sendError(reply, code, 403);
    }
    if (code === 'TERMINAL_STATE' || code === 'TRANSITION_NOT_ALLOWED' || code === 'UNKNOWN_STATE') {
      return sendError(reply, code, 409);
    }
    fastify.log.error('[payment transition]', err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }

  // Buyer disputes their own paid/fulfilled transaction (CAS-guarded, audited).
  fastify.post('/v1/payments/:id/dispute', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    const roles: string[] = (request.user as any).roles || [];
    const reason = ((request.body as any)?.reason || '').toString();

    try {
      const result = await transactionService.transition({
        transactionId: id,
        kind: 'DISPUTED',
        actorId: userId,
        actorRoles: roles,
        reason,
      });
      if (!result) return sendError(reply, 'TRANSITION_CONFLICT', 409);
      return sendSuccess(reply, result);
    } catch (err: any) {
      return handleTransitionError(reply, err);
    }
  });

  // Billing-admin only: REFUND / PARTIALLY_REFUNDED / REVERSED / CANCELLED.
  fastify.post('/v1/payments/:id/status', { preHandler: [fastify.authorize(['BILLING_ADMIN', 'ADMIN'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    const roles: string[] = (request.user as any).roles || [];
    const body = request.body as { action?: string; reason?: string };
    const action = (body?.action || '').toUpperCase();
    const stateMap: Record<string, 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'REVERSED' | 'CANCELLED'> = {
      REFUND: 'REFUNDED',
      PARTIAL_REFUND: 'PARTIALLY_REFUNDED',
      REVERSE: 'REVERSED',
      CANCEL: 'CANCELLED',
    };
    const kind = stateMap[action];
    if (!kind) {
      return sendError(reply, 'VALIDATION_FAILED', 400, { action: 'UNSUPPORTED_ACTION' });
    }

    try {
      const result = await transactionService.transition({
        transactionId: id,
        kind,
        actorId: userId,
        actorRoles: roles,
        reason: body?.reason,
      });
      if (!result) return sendError(reply, 'TRANSITION_CONFLICT', 409);
      return sendSuccess(reply, result);
    } catch (err: any) {
      return handleTransitionError(reply, err);
    }
  });

  // Audited transition history (transaction event log).
  fastify.get('/v1/payments/:id/history', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    try {
      const { paymentRepository } = await import('./repositories/payment.repository.js');
      const owned = await paymentRepository.findOwnedById(id, userId);
      const isAdmin = ((request.user as any).roles || []).some((r: string) => r === 'BILLING_ADMIN' || r === 'ADMIN');
      if (!owned && !isAdmin) return sendError(reply, 'PAYMENT_NOT_FOUND', 404);
      const history = await transactionService.history(id);
      return sendSuccess(reply, { transaction_id: id, history });
    } catch (err: any) {
      fastify.log.error('[payment history]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}