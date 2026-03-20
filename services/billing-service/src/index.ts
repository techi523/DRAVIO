import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { pool } from './db/client.js';

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    authorize(requiredRoles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const fastify: FastifyInstance = Fastify({ logger: true });

async function init() {
  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });
  await fastify.register(authMiddleware);
}

// await init(); // moved to bootstrap

fastify.get('/health', async () => {
  return { status: 'ok', service: 'billing-service' };
});

// Generate an invoice based on usage records
fastify.post('/v1/billing/invoices/generate', async (request: FastifyRequest, reply: FastifyReply) => {
  const { customer_id, isp_id } = request.body as any;
  
  try {
    // 1. Sum up usage for this customer that hasn't been invoiced yet
    const usageResult = await pool.query(
      "SELECT SUM(bytes_used) as total_bytes FROM billing.usage_records WHERE customer_id = $1 AND recorded_at > (SELECT COALESCE(MAX(created_at), '1970-01-01') FROM billing.invoices WHERE customer_id = $1)",
      [customer_id]
    );
    
    const bytesUsed = BigInt(usageResult.rows[0].total_bytes || '0');
    if (bytesUsed === 0n) {
      return { success: true, message: 'No new usage to invoice' };
    }

    // 2. Calculate amount (simplified pricing for MVP: $0.01 per MB)
    const amountUsd = (Number(bytesUsed) / (1024 * 1024)) * 0.01;
    
    // 3. Create invoice
    const invoiceResult = await pool.query(
      "INSERT INTO billing.invoices (customer_id, isp_id, amount_usd, currency, due_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '30 days') RETURNING id",
      [customer_id, isp_id, amountUsd, 'USD']
    );

    return { success: true, invoice_id: invoiceResult.rows[0].id, amount_usd: amountUsd };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ success: false, error: 'INVOICE_GENERATION_FAILED' });
  }
});

// List invoices for a customer
fastify.get('/v1/billing/invoices', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const customerId = (request.user as any).sub;
  
  const result = await pool.query(
    'SELECT * FROM billing.invoices WHERE customer_id = $1 ORDER BY created_at DESC',
    [customerId]
  );
  
  return { success: true, invoices: result.rows };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3006');
    await fastify.listen({ port, host: '0.0.0.0' });
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
  if (err) {
    console.error(err);
  }
  process.exit(1);
});
