import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authMiddleware } from '@dravio/auth-middleware';
import { GenerateInvoiceSchema } from './schema/billing.schema.js';
import { billingService } from './services/billing.service.js';
import { billingRepository } from './repositories/billing.repository.js';
import { sendSuccess, sendError } from './utils/response.js';

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: 'info'
  } 
});

async function init() {
  await fastify.register(cors);
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
  });
  await fastify.register(authMiddleware);
}

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'billing-service' }));

// Generate invoice
fastify.post('/v1/billing/invoices/generate', async (request: FastifyRequest, reply: FastifyReply) => {
  const result = GenerateInvoiceSchema.safeParse(request.body);
  if (!result.success) {
    return sendError(reply, 'VALIDATION_FAILED', 400, result.error.format());
  }

  try {
    const invoice = await billingService.generateInvoice(result.data);
    if (!invoice) {
        return sendSuccess(reply, { message: 'No new usage to invoice' });
    }
    return sendSuccess(reply, { invoice_id: invoice.id, amount_usd: invoice.amount_usd }, 201);
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

// List invoices
fastify.get('/v1/billing/invoices', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
  const customerId = (request.user as any).sub;
  
  try {
    const invoices = await billingRepository.listInvoicesByCustomer(customerId);
    return sendSuccess(reply, { invoices });
  } catch (err: any) {
    fastify.log.error(err);
    return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3006');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Billing service listening on port ${port}`);
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
