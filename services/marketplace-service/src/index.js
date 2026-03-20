"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const ioredis_1 = require("ioredis");
const auth_middleware_1 = require("@dravio/auth-middleware");
const fastify = (0, fastify_1.default)({ logger: true });
const redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
async function init() {
    await fastify.register(cors_1.default);
    await fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'dev-secret-key-12345',
    });
    await fastify.register(auth_middleware_1.authMiddleware);
}
// await init(); // moved to bootstrap
fastify.get('/health', async () => {
    return { status: 'ok', service: 'marketplace-service' };
});
// Seller heartbeat: updates location and availability in Redis
fastify.post('/v1/marketplace/heartbeat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const sellerId = request.user.sub;
    const { lat, lon, price_per_gb } = request.body;
    // Store location for geo-search (expiry 5 mins)
    await redis.geoadd('active_sellers_geo', lon, lat, sellerId);
    // Store metadata in a hash with 300s TTL
    await redis.hset(`seller:${sellerId}`, {
        price: price_per_gb,
        last_seen: Date.now().toString()
    });
    await redis.expire(`seller:${sellerId}`, 300);
    return { success: true };
});
// Search sellers by geo-location (real Redis GEOSEARCH)
fastify.get('/v1/marketplace/search', async (request, reply) => {
    const { lat, lon, radius = 5, unit = 'km' } = request.query;
    // Find sellers within radius
    const sellerIds = await redis.geosearch('active_sellers_geo', 'FROMLONLAT', lon, lat, 'BYRADIUS', radius, unit, 'WITHDIST');
    // Fetch metadata for each seller
    const results = await Promise.all(sellerIds.map(async (row) => {
        const [id, dist] = row;
        const meta = await redis.hgetall(`seller:${id}`);
        return {
            id,
            distance: dist,
            unit,
            price_per_gb: parseFloat(meta.price || '0'),
            last_seen: parseInt(meta.last_seen || '0')
        };
    }));
    return { results };
});
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3003');
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
