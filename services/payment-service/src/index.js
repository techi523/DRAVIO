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
    return { status: 'ok', service: 'payment-service' };
});
// Initiate a payment (Buyer App -> Gateway -> Payment Service)
fastify.post('/v1/payments/initiate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { amount_usd, currency, method, session_id } = request.body;
    const userId = request.user.sub;
    try {
        // 1. Log transaction as PENDING in local DB
        const result = await client_js_1.pool.query('INSERT INTO payments.transactions (session_id, user_id, amount_usd, currency, payment_method, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [session_id, userId, amount_usd, currency || 'USD', method, 'PENDING']);
        const transactionId = result.rows[0].id;
        // 2. Mocking Stripe/M-Pesa payment intent creation
        // const intent = await stripe.paymentIntents.create({ amount: amount_usd * 100, ... });
        const providerRef = `mock_intent_${Date.now()}`;
        await client_js_1.pool.query('UPDATE payments.transactions SET provider_ref = $1 WHERE id = $2', [providerRef, transactionId]);
        return {
            success: true,
            payment_id: transactionId,
            provider_ref: providerRef,
            checkout_url: `https://checkout.dravio.com/${providerRef}`
        };
    }
    catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ success: false, error: 'PAYMENT_INITIATION_FAILED' });
    }
});
// Webhook for payment confirmation
fastify.post('/v1/payments/webhook', async (request, reply) => {
    const { event, provider_ref } = request.body;
    if (event === 'payment_intent.succeeded') {
        await client_js_1.pool.query('UPDATE payments.transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE provider_ref = $2', ['COMPLETED', provider_ref]);
        // TODO: Emit Kafka event dm.payment.completed
        fastify.log.info(`Payment completed for ref: ${provider_ref}`);
    }
    return { received: true };
});
const start = async () => {
    try {
        await fastify.listen({ port: 3004, host: '0.0.0.0' });
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
