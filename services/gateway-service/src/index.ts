import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';

const isLocal = process.env.LOCAL_DEV === 'true';

const SERVICES = {
  auth:        isLocal ? 'http://localhost:3000' : 'http://auth-service:3000',
  user:        isLocal ? 'http://localhost:3002' : 'http://user-service:3002',
  marketplace: isLocal ? 'http://localhost:3003' : 'http://marketplace-service:3000',
  session:     isLocal ? 'http://localhost:3005' : 'http://session-service:3005',
  payment:     isLocal ? 'http://localhost:3004' : 'http://payment-service:3005',
  billing:     isLocal ? 'http://localhost:3006' : 'http://billing-service:3006',
  isp:         isLocal ? 'http://localhost:8083' : 'http://isp-service:8080',
} as const;

const fastify = Fastify({ logger: true });

async function build() {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.');
  }

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8000'];

  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── JWT ────────────────────────────────────────────────────────────────────
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  });

  // ── Health endpoints ───────────────────────────────────────────────────────
  fastify.get('/', async () => ({
    status: 'ok',
    service: 'dravio-gateway',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'gateway-service',
    uptime: process.uptime(),
  }));

  // ── HTTP Proxy routes ──────────────────────────────────────────────────────

  // ── High-Performance Connection Pooling & HTTP Keep-Alive configuration ──
  const proxyConfig = {
    http: {
      agentOptions: {
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 256,
        maxFreeSockets: 64
      },
      requestOptions: {
        timeout: 10000
      }
    }
  };

  // Auth  (3000)
  fastify.register(proxy, {
    upstream: SERVICES.auth,
    prefix: '/v1/auth',
    rewritePrefix: '/v1/auth',
    ...proxyConfig
  });

  // Users  (3002)
  fastify.register(proxy, {
    upstream: SERVICES.user,
    prefix: '/v1/users',
    rewritePrefix: '/v1/users',
    ...proxyConfig
  });

  // Marketplace  (3000)
  fastify.register(proxy, {
    upstream: SERVICES.marketplace,
    prefix: '/v1/marketplace',
    rewritePrefix: '/v1/marketplace',
    ...proxyConfig
  });

  // Sessions  (3005)
  fastify.register(proxy, {
    upstream: SERVICES.session,
    prefix: '/v1/sessions',
    rewritePrefix: '/v1/sessions',
    ...proxyConfig
  });

  // Payments  (3005)
  fastify.register(proxy, {
    upstream: SERVICES.payment,
    prefix: '/v1/payments',
    rewritePrefix: '/v1/payments',
    ...proxyConfig
  });

  // Billing  (3006) – primary
  fastify.register(proxy, {
    upstream: SERVICES.billing,
    prefix: '/v1/billing',
    rewritePrefix: '/v1/billing',
    ...proxyConfig
  });

  // Billing alias – mobile /wallet screen
  fastify.register(proxy, {
    upstream: SERVICES.billing,
    prefix: '/v1/wallet',
    rewritePrefix: '/v1/billing',
    ...proxyConfig
  });

  // ISP  (8080)
  fastify.register(proxy, {
    upstream: SERVICES.isp,
    prefix: '/v1/isp',
    rewritePrefix: '/v1/isp',
    ...proxyConfig
  });
}

// ── Upstream Socket.io proxy clients ──────────────────────────────────────────
// Connects to internal services that emit Socket.io events and re-broadcasts
// them to all mobile clients connected to the gateway.
function connectUpstreamSockets(io: SocketIOServer) {
  const upstreams: Array<{ name: string; url: string; events: string[] }> = [
    {
      name: 'billing-service',
      url: SERVICES.billing,
      events: ['earnings_update', 'billing_alert', 'balance_update'],
    },
    {
      name: 'session-service',
      url: SERVICES.session,
      events: ['peer_update', 'session_started', 'session_ended', 'metering_update'],
    },
  ];

  for (const { name, url, events } of upstreams) {
    const client = ClientIO(url, {
      reconnection: true,
      reconnectionDelay: 3000,
      timeout: 10000,
    });

    client.on('connect', () =>
      fastify.log.info(`[upstream:${name}] connected`)
    );
    client.on('disconnect', (reason: string) =>
      fastify.log.warn(`[upstream:${name}] disconnected – ${reason}`)
    );
    client.on('connect_error', (err: Error) =>
      fastify.log.warn(`[upstream:${name}] error – ${err.message}`)
    );

    for (const event of events) {
      client.on(event, (data: unknown) => {
        io.emit(event, data);
        fastify.log.debug(`[upstream:${name}] proxied event: ${event}`);
      });
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await build();
    await fastify.listen({ port: 8080, host: '0.0.0.0' });

    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8000'];

    // Attach Socket.io directly to Fastify's underlying Node http.Server.
    // This avoids any plugin type-overload issues while sharing the same port.
    const io = new SocketIOServer(fastify.server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Mandatory JWT Authentication Middleware for WebSockets
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('AUTHENTICATION_FAILED: Missing token'));
      }

      try {
        const decoded = fastify.jwt.verify(token) as { sub: string };
        (socket as any).userId = decoded.sub;
        fastify.log.info(`[gateway] Socket ${socket.id} authenticated for user ${(socket as any).userId}`);
        next();
      } catch (err) {
        fastify.log.warn(`[gateway] Socket ${socket.id} authentication failed: ${err}`);
        next(new Error('AUTHENTICATION_FAILED: Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      fastify.log.info(`[gateway] client connected: ${socket.id} (user: ${userId})`);

      // Secure room subscription: Users can only join their own room or global rooms
      socket.on('join_room', (room: string) => {
        // Enforce that a user can only join their own room
        if (room === userId || room === 'global_announcements') {
          socket.join(room);
          fastify.log.info(`[gateway] ${socket.id} joined secure room: ${room}`);
        } else {
          fastify.log.warn(`[gateway] ${socket.id} attempted to join unauthorized room: ${room}`);
          socket.emit('error', { message: 'UNAUTHORIZED_ROOM_ACCESS' });
        }
      });

      socket.on('disconnect', (reason) => {
        fastify.log.info(`[gateway] client disconnected: ${socket.id} (user: ${userId}) – ${reason}`);
      });
    });

    connectUpstreamSockets(io);

    fastify.log.info('✅ Gateway ready on http://0.0.0.0:8080  (Socket.io on ws://0.0.0.0:8080)');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
