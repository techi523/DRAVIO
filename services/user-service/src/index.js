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
    return { status: 'ok', service: 'user-service' };
});
// Create profile (called by auth-service)
fastify.post('/v1/users', async (request, reply) => {
    const { auth_user_id, full_name, country_code } = request.body;
    const result = await client_js_1.pool.query('INSERT INTO users.profiles (auth_user_id, full_name, country_code) VALUES ($1, $2, $3) RETURNING id', [auth_user_id, full_name, country_code]);
    return { success: true, profileId: result.rows[0].id };
});
// Get self profile
fastify.get('/v1/users/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const authUserId = request.user.sub;
    const result = await client_js_1.pool.query('SELECT * FROM users.profiles WHERE auth_user_id = $1', [authUserId]);
    if (result.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'PROFILE_NOT_FOUND' });
    }
    return { success: true, profile: result.rows[0] };
});
const start = async () => {
    try {
        await fastify.listen({ port: 3002, host: '0.0.0.0' });
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
