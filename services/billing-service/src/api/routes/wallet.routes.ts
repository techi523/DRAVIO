import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { walletRepository } from '../../repositories/wallet.repository.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { pool } from '../../db/client.js';

export async function walletRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/billing/balance', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request.user as any).sub;
      const { balance_usd } = await walletRepository.getBalance(userId);
      return sendSuccess(reply, { balance_usd });
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, { balance_usd: 0.00 });
    }
  });

  fastify.post('/v1/billing/topup', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount_usd } = request.body as any;
    const userId = (request.user as any).sub;
    try {
      const new_balance = await walletRepository.topup(userId, Number(amount_usd));
      return sendSuccess(reply, { success: true, new_balance_usd: new_balance });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/billing/invoices', { 
    preHandler: [fastify.authenticate] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const customerId = (request.user as any).sub;
    try {
      // Re-using the logic from the old repository (which was already in billingRepository)
      // I'll need to make sure the new walletRepository or a separate invoiceRepository handles this.
      // For now, I'll add it to walletRepository or billingRepository.
      const result = await pool.query(
        'SELECT * FROM billing.invoices WHERE customer_id = $1 ORDER BY created_at DESC',
        [customerId]
      );
      return sendSuccess(reply, { invoices: result.rows });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}
