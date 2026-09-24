# DRAVIO Security Architecture

Date: 2026-09-20. Status: hardened baseline (see `production-audit.md`).

## Trust boundaries

```
[User device]
   │ 1. TLS + Bearer access token (JWT, 15 min)
   ▼
[Fastify backend (backend/)]
   │ 2. PostgreSQL (auth/users/payments/billing/sessions/audit)
   │ 3. Redis (sessions, seller heartbeats, rate state)
   │ 4. Kafka (async events: telemetry, audit, fraud)
   │ 5. Stripe / M-Pesa / Twilio / Firebase / Cloudinary (external SaaS)
   ▼
[Next.js buyer-web] ── [admin-portal (admin-only)] ── [Expo mobile]
```

- Internet-facing ingress is only the Fastify API + web sockets. Postgres, Redis,
  Kafka and all provider secrets are never exposed to clients.
- Admin capabilities live behind `requireRoles` which `jwtVerify()`s first and
  derives roles exclusively from the token (no fabricated identities).

## Authentication

- Passwords hashed with bcrypt (cost 10). Emails normalized (trim/lowercase).
- Access tokens: HS256 JWTs signed with `JWT_SECRET` (min 32 bytes enforced at
  startup via `backend/src/config/env.ts`), expiry `JWT_ACCESS_TTL` (900 s).
- Refresh tokens: 64-byte random hex, stored **hashed** (sha-256) in
  `auth.refresh_tokens` with expiry (`JWT_REFRESH_TTL`, 30 d) and `revoked` flag.
- Rotation: `POST /v1/auth/refresh` with body `{ refresh_token }` revokes the old
  token and issues a new pair. Legacy Bearer re-sign path retained for the
  existing frontends. `POST /v1/auth/logout` revokes the presented refresh token
  or all of a user's tokens.
- OTP: Twilio Verify in production, random 6-digit code (never `123456`); a mock
  store exists ONLY under `NODE_ENV=test`. Rate limits: login 5/min, otp/send
  3/min, otp/verify 5/min.
- Improper domain: OAuth providers verified via official tokens/endpoints;
  `role_preference` restricted to BUYER/SELLER; ADMIN roles are provisioned
  only server-side.

## Authorization

- `fastify.authenticate` -> `request.jwtVerify()` (401 on failure).
- `fastify.authorize(roles)` for role-gated internals (e.g. `/v1/internal/*`).
- Admin: `requireRoles(...)` verifies the JWT, then grants access to tokens whose
  `roles` include `ADMIN`/`SUPER_ADMIN` or a listed role. No unauthenticated
  fallback exists.
- Ownership scoping: payments (`findOwnedById`), profile updates (`/users/me`),
  wallet top-ups (payment-derived), sessions (buyer derived from token) — a user
  can only ever read/mutate their own resources.

## Payments integrity

- `/v1/payments/webhook` requires a valid `Stripe-Signature`; only
  `payment_intent.succeeded` is acted upon, and only when the involved Stripe
  PaymentIntent id maps to a `PENDING` transaction.
- `/v1/payments/mpesa/callback` reconciles the callback **amount** against the
  stored transaction and requires `PENDING` (`Amount` mismatch -> transaction
  FAILED and no wallet credit).
- All transitions are guarded (`WHERE status='PENDING'`): replays can never
  re-flip a COMPLETED/FAILED transaction, so events/wallet credits fire at most
  once.
- Money math is integer-cent based (`backend/src/modules/payment/money.ts`).
  Platform fee is a single source of truth (`PLATFORM_FEE_PCT=0.20`) computed at
  completion and stored with the transaction (`platform_fee_usd`,
  `seller_net_usd`).
- Completion (mark COMPLETED + buyer wallet credit + audit ledger entry) is one
  DB transaction. `billing.ledger_entries` is the append-only money-movement log.

## Billing integrity

- Session price is resolved server-side from the seller's marketplace listing
  (Redis `seller:<id>`), never from the client.
- Usage billing is **delta-based** (`committedBytes` in the Redis session): only
  new bytes since the last committed report are billed; duplicate/reordered
  reports bill nothing.
- Sub-cent charges carry over (`pendingCostUsd`) and settle only as whole cents,
  so per-MB micro-charges are never lost and never round to free usage.
- Buyer debit + seller credit + earnings insert happen in one DB transaction;
  the committed-byte counter only advances after the transaction commits.

## Network / transport

- Fastify: helmet, CORS allow-list (explicit origins, not `*`), global rate
  limit 200/min, gzip. Redis connections use `rediss://` (Upstash) in prod.
- Socket.IO connections verify a JWT from the client handshake before use.
- Mobile production builds disable cleartext traffic; API base URL comes from
  `EXPO_PUBLIC_API_URL` (EAS env), never a hardcoded localhost.

## Secrets management

- `.env.*.template` committed; real secrets only in the deployment platform
  (Railway/Vercel/EAS variables).
- No provider credentials in committed source. Startup fails fast if
  `JWT_SECRET`, Stripe/M-Pesa provider keys, etc. are absent.
- `google-services.json` and keystores are gitignored / placeholder.

## Key files

| Concern | Path |
|---|---|
| RBAC | `backend/src/modules/admin/middleware/rbac.ts` |
| Auth routes | `backend/src/modules/auth/index.ts` |
| Refresh store | `backend/src/modules/auth/repositories/auth.repository.ts` |
| OTP | `backend/src/modules/auth/services/otp.service.ts` |
| Money math | `backend/src/modules/payment/money.ts` |
| Payment state repo | `backend/src/modules/payment/repositories/payment.repository.ts` |
| Payment routes | `backend/src/modules/payment/index.ts` |
| Usage billing | `backend/src/modules/billing/core/engines/byte-tracker.ts` |
| Session trust | `backend/src/modules/billing/core/session-manager.ts` |
| Env validation | `backend/src/config/env.ts` |
| DB hardening | `backend/migrations/001_hardening.sql` |