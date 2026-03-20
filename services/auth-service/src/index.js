"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const axios_1 = __importDefault(require("axios"));
const auth_middleware_1 = require("@dravio/auth-middleware");
const client_js_1 = require("./db/client.js");
const fastify = (0, fastify_1.default)({ logger: true });
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
async function init() {
    // Register plugins
    await fastify.register(cors_1.default);
    await fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
    });
    await fastify.register(auth_middleware_1.authMiddleware);
}
await init();
// Health check
fastify.get('/health', async () => {
    return { status: 'ok', service: 'auth-service' };
});
// Registration logic
fastify.post('/v1/auth/register', async (request, reply) => {
    const { email, password, full_name, country_code } = request.body;
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    try {
        const result = await client_js_1.pool.query('INSERT INTO auth.users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, passwordHash]);
        const userId = result.rows[0].id;
        // Call user-service to create profile
        try {
            await axios_1.default.post(`${USER_SERVICE_URL}/v1/users`, {
                auth_user_id: userId,
                full_name,
                country_code
            });
        }
        catch (userErr) {
            // Rollback auth user if profile creation fails (simplified for MVP)
            await client_js_1.pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
            return reply.code(500).send({ success: false, error: 'PROFILE_CREATION_FAILED' });
        }
        return { success: true, userId };
    }
    catch (err) {
        if (err.code === '23505') { // Unique violation
            return reply.code(400).send({ success: false, error: 'EMAIL_ALREADY_EXISTS' });
        }
        throw err;
    }
});
// Login logic
fastify.post('/v1/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    const result = await client_js_1.pool.query('SELECT id, password_hash FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
        return reply.code(401).send({ success: false, error: 'INVALID_CREDENTIALS' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt_1.default.compare(password, user.password_hash);
    if (!isValid) {
        return reply.code(401).send({ success: false, error: 'INVALID_CREDENTIALS' });
    }
    const token = fastify.jwt.sign({ sub: user.id, roles: ['buyer'] });
    return { success: true, access_token: token };
});
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001');
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
