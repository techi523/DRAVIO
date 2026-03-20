"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify = (0, fastify_1.default)({ logger: true });
await fastify.register(cors_1.default);
await fastify.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
});
fastify.get('/health', async () => {
    return { status: 'ok', service: 'gateway-service' };
});
// Proxy routes to microservices
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3001',
    prefix: '/v1/auth',
    rewritePrefix: '/v1/auth'
});
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3002',
    prefix: '/v1/users',
    rewritePrefix: '/v1/users'
});
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3003',
    prefix: '/v1/marketplace',
    rewritePrefix: '/v1/marketplace'
});
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3004',
    prefix: '/v1/payments',
    rewritePrefix: '/v1/payments'
});
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3005',
    prefix: '/v1/sessions',
    rewritePrefix: '/v1/sessions'
});
fastify.register(http_proxy_1.default, {
    upstream: 'http://localhost:3006',
    prefix: '/v1/billing',
    rewritePrefix: '/v1/billing'
});
const start = async () => {
    try {
        await fastify.listen({ port: 8000, host: '0.0.0.0' });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
