"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fastify = (0, fastify_1.default)({ logger: true });
fastify.post('/payment/intent', async (request, reply) => {
    const { amount, userId } = request.body;
    // Mock Stripe Payment Intent creation
    const intent = {
        id: `pi_${Math.random().toString(36).substring(7)}`,
        userId,
        amount,
        currency: 'USD',
        status: 'pending'
    };
    return intent;
});
fastify.listen({ port: 3005, host: '0.0.0.0' });
