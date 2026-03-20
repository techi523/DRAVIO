"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const auth_middleware_1 = require("@dravio/auth-middleware");
const client_js_1 = require("./db/client.js");
const fastify = (0, fastify_1.default)({ logger: true });
async function init() {
    await fastify.register(cors_1.default);
    await fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
    });
    await fastify.register(auth_middleware_1.authMiddleware);
}
// await init(); // moved to bootstrap
fastify.get('/health', async () => {
    return { status: 'ok', service: 'billing-service' };
});
// Generate an invoice based on usage records
fastify.post('/v1/billing/invoices/generate', async (request, reply) => {
    const { customer_id, isp_id } = request.body;
    try {
        // 1. Sum up usage for this customer that hasn't been invoiced yet
        const usageResult = await client_js_1.pool.query("SELECT SUM(bytes_used) as total_bytes FROM billing.usage_records WHERE customer_id = $1 AND recorded_at > (SELECT COALESCE(MAX(created_at), '1970-01-01') FROM billing.invoices WHERE customer_id = $1)", [customer_id]);
        const bytesUsed = BigInt(usageResult.rows[0].total_bytes || '0');
        if (bytesUsed === 0n) {
            return { success: true, message: 'No new usage to invoice' };
        }
        // 2. Calculate amount (simplified pricing for MVP: $0.01 per MB)
        const amountUsd = (Number(bytesUsed) / (1024 * 1024)) * 0.01;
        // 3. Create invoice
        const invoiceResult = await client_js_1.pool.query("INSERT INTO billing.invoices (customer_id, isp_id, amount_usd, currency, due_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '30 days') RETURNING id", [customer_id, isp_id, amountUsd, 'USD']);
        return { success: true, invoice_id: invoiceResult.rows[0].id, amount_usd: amountUsd };
    }
    catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ success: false, error: 'INVOICE_GENERATION_FAILED' });
    }
});
// List invoices for a customer
fastify.get('/v1/billing/invoices', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const customerId = request.user.sub;
    const result = await client_js_1.pool.query('SELECT * FROM billing.invoices WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]);
    return { success: true, invoices: result.rows };
});
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3006');
        await fastify.listen({ port, host: '0.0.0.0' });
    }
    catch (err) {
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
