"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
const fastify = (0, fastify_1.default)({ logger: true });
// Route to Auth Service
fastify.register(http_proxy_1.default, {
    upstream: 'http://auth-service:3000',
    prefix: '/auth'
});
// Route to Marketplace Service
fastify.register(http_proxy_1.default, {
    upstream: 'http://marketplace-service:3000',
    prefix: '/marketplace'
});
fastify.listen({ port: 80, host: '0.0.0.0' });
