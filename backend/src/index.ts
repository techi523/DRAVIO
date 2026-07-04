import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import { Server as SocketIOServer } from 'socket.io';
import fp from 'fastify-plugin';

// shared auth middleware
import { authMiddlewarePlugin } from './modules/auth/middleware.js';
// Module route registrations
import { registerAuthRoutes } from './modules/auth/index.js';
import { registerUserRoutes } from './modules/users/index.js';
import { registerMarketplaceRoutes } from './modules/marketplace/index.js';
import { registerSessionRoutes } from './modules/session/index.js';
import { registerPaymentRoutes } from './modules/payment/index.js';
import { registerBillingRoutes } from './modules/billing/index.js';
import { registerISPRoutes } from './modules/isp/index.js';
import { registerAdminRoutes } from './modules/admin/index.js';
import { registerFraudRoutes } from './modules/fraud/index.js';
// Background services
import { startAnalyticsAggregator } from './modules/analytics/index.js';
import { startMeteringProcessor } from './modules/metering/index.js';
import { startFraudConsumer } from './modules/fraud/index.js';
import { startAuditConsumer } from './modules/audit/index.js';
import { testConnection } from './db/client.js';
import { getRedis } from './db/redis.js';

const fastify: FastifyInstance = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8000'];

const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
  if (!origin) return callback(null, true);
  if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'), false);
};

async function build() {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.');
  }

  await fastify.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    strictPreflight: false,
  });

  // Security
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await fastify.register(compress, { global: true });

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });

  // Auth middleware (decorates fastify with authenticate/authorize)
  await fastify.register(authMiddlewarePlugin);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error.code === 'FST_REPLY_FROM_INTERNAL_SERVER_ERROR' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return reply.status(502).send({
        error: 'BAD_GATEWAY',
        message: `Upstream service unavailable: ${request.url}`,
        statusCode: 502,
      });
    }
    fastify.log.error(error);
    return reply.status(error.statusCode || 500).send({
      error: error.message || 'INTERNAL_SERVER_ERROR',
      statusCode: error.statusCode || 500,
    });
  });

  // ── Global Health Endpoints ──
  fastify.get('/', async () => ({
    status: 'ok',
    service: 'dravio-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'dravio-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // ── Register Module Routes ──
  // Each module registers its own /health + business routes on the shared Fastify instance
  await registerAuthRoutes(fastify);
  await registerUserRoutes(fastify);
  await registerMarketplaceRoutes(fastify);
  await registerSessionRoutes(fastify);
  await registerPaymentRoutes(fastify);
  await registerBillingRoutes(fastify);
  registerISPRoutes(fastify);
  registerFraudRoutes(fastify);
  // Admin routes need Socket.IO - passed later after we create io
}

async function start() {
  try {
    await build();

    // Socket.IO on the same port (must attach + register routes before fastify.listen())
    const io = new SocketIOServer(fastify.server, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Socket.IO JWT auth
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('AUTHENTICATION_FAILED: Missing token'));
      }
      try {
        const decoded = fastify.jwt.verify(token) as { sub: string };
        (socket as any).userId = decoded.sub;
        fastify.log.info(`[Socket] ${socket.id} authenticated for user ${(socket as any).userId}`);
        next();
      } catch (err) {
        fastify.log.warn(`[Socket] ${socket.id} authentication failed`);
        next(new Error('AUTHENTICATION_FAILED: Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      fastify.log.info(`[Socket] client connected: ${socket.id} (user: ${userId})`);

      socket.on('join_room', (room: string) => {
        if (room === userId || room === 'global_announcements') {
          socket.join(room);
          fastify.log.info(`[Socket] ${socket.id} joined room: ${room}`);
        } else {
          fastify.log.warn(`[Socket] ${socket.id} attempted unauthorized room: ${room}`);
          socket.emit('error', { message: 'UNAUTHORIZED_ROOM_ACCESS' });
        }
      });

      socket.on('disconnect', (reason) => {
        fastify.log.info(`[Socket] client disconnected: ${socket.id} (user: ${userId}) - ${reason}`);
      });
    });

    // Register admin routes with Socket.IO
    await registerAdminRoutes(fastify, io);

    const port = parseInt(process.env.PORT || '8080');
    await fastify.listen({ port, host: '0.0.0.0' });

    // Initialize connections
    const dbOk = await testConnection();
    if (!dbOk) {
      fastify.log.warn('Database connection failed - some features may be degraded');
    }

    const redis = getRedis();
    if (redis) {
      fastify.log.info('Redis client initialized');
    } else {
      fastify.log.warn('Redis not available - caching features degraded');
    }

    // Start background services
    startAnalyticsAggregator().catch(err => fastify.log.warn('[Analytics] Failed to start:', err));
    startMeteringProcessor().catch(err => fastify.log.warn('[Metering] Failed to start:', err));
    startFraudConsumer().catch(err => fastify.log.warn('[Fraud] Failed to start:', err));
    startAuditConsumer().catch(err => fastify.log.warn('[Audit] Failed to start:', err));

    fastify.log.info(`DRAVIO Backend ready on http://0.0.0.0:${port} (Socket.IO on ws://0.0.0.0:${port})`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
      io.close(() => fastify.log.info('Socket.IO connections closed'));
      await fastify.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
