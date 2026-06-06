import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { walletRepository } from '../../repositories/wallet.repository.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { pool } from '../../db/client.js';

export async function walletRoutes(fastify: FastifyInstance) {
  // GET /v1/billing/balance — returns balance for authenticated user
  fastify.get('/v1/billing/balance', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request.user as any).sub;
      const { balance_usd } = await walletRepository.getBalance(userId);
      return sendSuccess(reply, {
        balance_usd,
        balance: balance_usd, // alias for mobile client compatibility (Wallet.tsx uses .balance)
      });
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, { balance_usd: 0.00, balance: 0.00 });
    }
  });

  // POST /v1/billing/topup — add funds to wallet
  fastify.post('/v1/billing/topup', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount_usd } = request.body as any;
    const userId = (request.user as any).sub;
    try {
      const new_balance = await walletRepository.topup(userId, Number(amount_usd));
      return sendSuccess(reply, { success: true, new_balance_usd: new_balance, new_balance });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // POST /v1/billing/withdraw — withdraw seller earnings
  fastify.post('/v1/billing/withdraw', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    const { amount_usd, method, phone_number } = request.body as any;

    if (!amount_usd || typeof amount_usd !== 'number' || amount_usd <= 0) {
      return sendError(reply, 'INVALID_AMOUNT', 400);
    }
    if (!method) {
      return sendError(reply, 'PAYMENT_METHOD_REQUIRED', 400);
    }

    try {
      // Atomically deduct balance and create a payout record in one query
      const result = await pool.query(
        `WITH deducted AS (
           UPDATE billing.wallets
              SET balance_usd = balance_usd - $2,
                  updated_at  = NOW()
            WHERE customer_id  = $1
              AND balance_usd >= $2
           RETURNING balance_usd
         )
         INSERT INTO payments.payouts (seller_id, amount_usd, currency, status)
         SELECT $1::UUID, $2, 'USD', 'PENDING'
           FROM deducted
         RETURNING id, status`,
        [userId, amount_usd]
      );

      if (result.rowCount === 0) {
        return sendError(reply, 'INSUFFICIENT_BALANCE', 400);
      }

      return sendSuccess(reply, {
        success: true,
        payout_id: result.rows[0].id,
        status: 'PENDING',
        message: 'Withdrawal initiated. Funds arrive within 1-3 business days.',
      });
    } catch (err: any) {
      fastify.log.error(err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // GET /v1/billing/invoices
  fastify.get('/v1/billing/invoices', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const customerId = (request.user as any).sub;
    try {
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

  // GET /v1/billing/transactions — combined credit/debit history
  fastify.get('/v1/billing/transactions', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const result = await pool.query(
        `(
          SELECT
            id, 'credit' AS type, amount_usd AS amount,
            'Wallet Top-up' AS description, status, created_at
          FROM billing.invoices
          WHERE customer_id = $1 AND status = 'PAID'
        )
        UNION ALL
        (
          SELECT
            id, 'debit' AS type, cost_accumulated AS amount,
            'Data Session' AS description, status, started_at AS created_at
          FROM billing.sessions
          WHERE customer_id = $1 AND cost_accumulated > 0
        )
        ORDER BY created_at DESC
        LIMIT 50`,
        [userId]
      );
      return sendSuccess(reply, result.rows);
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, []);
    }
  });

  // GET /v1/billing/sessions/active
  fastify.get('/v1/billing/sessions/active', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const result = await pool.query(
        `SELECT id, customer_id, hardware_id, session_token, bytes_used,
                cost_accumulated, status, started_at, ended_at
           FROM billing.sessions
          WHERE customer_id = $1 AND status = 'ACTIVE'
          ORDER BY started_at DESC`,
        [userId]
      );
      return sendSuccess(reply, { sessions: result.rows });
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, { sessions: [] });
    }
  });

  // GET /v1/billing/sessions/history
  fastify.get('/v1/billing/sessions/history', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const result = await pool.query(
        `SELECT id, customer_id, hardware_id, session_token, bytes_used,
                cost_accumulated, status, started_at, ended_at
           FROM billing.sessions
          WHERE customer_id = $1
          ORDER BY started_at DESC
          LIMIT 50`,
        [userId]
      );
      return sendSuccess(reply, { sessions: result.rows });
    } catch (err: any) {
      fastify.log.error(err);
      return sendSuccess(reply, { sessions: [] });
    }
  });
}
