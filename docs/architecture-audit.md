# DRAVIO Architecture Audit

Status: **Reconciled build** — component paths verified end-to-end against the consolidated Fastify backend (2026-09-21).

This document records the factual architecture of the production system as it currently exists, the integration gaps found between components, and the fixes applied. It is written from direct inspection of the codebase, not from design intent.

## 1. Repository Layout

```
DRAVIO/
├── package.json                 # npm workspaces: services/*, apps/*, packages/*
├── master_init.sql              # canonical Postgres schema (auth, users, payments, billing, sessions, analytics, audit)
├── backend/                     # CONSOLIDATED Fastify API (TypeScript, ESM, tsc build) — the production API
│   └── src/
│       ├── index.ts             # app bootstrap; env validation fail-fast (backend/src/config/env.ts)
│       ├── db/                  # pg Pool (client.ts), Redis (redis.ts, redis-cache.ts)
│       ├── events/              # Kafka producer/consumer wiring
│       └── modules/             # 12 feature modules (see §2)
├── apps/
│   ├── mobile-app/              # Expo React Native app (app store client)
│   ├── buyer-web/               # Next.js client (buyer/session/wallet)
│   └── admin-portal/            # Next.js admin web portal
├── services/                    # LEGACY microservices — deprecated, not part of the production build
├── infra/                       # deployment/infra config
├── scripts/
└── tests/                       # Playwright (present; emulator/E2E gated on infra)
```

Deployment notes:
- The backend is the single API surface. The legacy `services/*` microservices are dead code and must not be deployed.
- Frontends ship with `localhost` build-time fallbacks only; production URLs are injected via env (`EXPO_PUBLIC_API_URL`, `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_API_URL`).
- No live Android SDK/emulator is provisioned on the build machine; mobile live-verification is BLOCKED (see `docs/testing/`).

## 2. Backend Modules (`backend/src/modules`)

| Module | Responsibility | Key routes |
|---|---|---|
| `admin` | SOC dashboard, telemetry, lockdown, user/billing/network/soc/rules control API | `/admin/*` **and** `/v1/admin/*`, `/v1/admin/users|billing|network|soc|rules/*` |
| `analytics` | Metrics aggregation | — |
| `audit` | Immutable audit log | — |
| `auth` | Email/password, OAuth, OTP; JWT issue/verify/refresh | `/v1/auth/*` |
| `billing` | Wallet, invoices, sessions, usage billing (byte tracker) | `/v1/billing/*` |
| `fraud` | Rule-based fraud signals | — |
| `isp` | ISP-side management | — |
| `marketplace` | Seller heartbeats (Redis geo), search, pricing | `/v1/marketplace/*` |
| `metering` | Usage metering | — |
| `payment` | Stripe/M-Pesa initiation, webhooks, status, wallet deduction | `/v1/payments/*` |
| `session` | Connectivity sessions (relay config, handoff) | `/v1/sessions/*` |
| `users` | Profile read/update, self stats | `/v1/users/me`, `/v1/users/me/stats` |

Auth model (verified in `auth`): JWT payload `{ sub, roles, role }`; `fastify.authenticate` = `jwtVerify`; role gates via `authorize(...)` / admin `requireRoles([...])`. There is intentionally NO public `POST /v1/users`.

## 3. Money, Payments and Billing (authoritative flow)

- Money is handled in integer cents internally; wallet `balance_usd` is `DECIMAL(12,2)` with `CHECK (balance_usd >= 0)`; `payments.transactions` `DECIMAL(15,4)` with `amount_usd > 0`.
- `computeFees` applies `PLATFORM_FEE_PCT` (0.20 clamped in `config/env.ts`); `settleCentCarry` accumulates sub-cent charges so no per-MB micro-charge is lost.
- Top-ups **only** via verified payment: `POST /v1/payments/initiate` (auth, idempotency_key UNIQUE) → `GET /v1/payments/:id/status` (ownership-scoped). `POST /v1/billing/topup` is intentionally disabled (`409 WALLET_TOPUP_REQUIRES_PAYMENT`).
- Withdrawals: `POST /v1/billing/withdraw` requires `amount_usd`, `method`, `phone_number`; sellers-only (`403 SELLER_ACCOUNT_REQUIRED`), max `$25,000`, atomic deduct + `payments.payouts` insert.
- Paid session: `POST /v1/billing/sessions/start {hardwareId, sellerId}` — price is resolved **server-side** from the seller listing (client `pricePerMb` is ignored); requires `balance >= $0.50`; creates connectivity session + billing session; returns `{ sessionToken, vpn_config }`.
- Usage: `POST /v1/billing/usage {sessionId, dataUsedMb}` → `byteTrackerEngine.processUsageUpdate` bills only the delta since the last committed counter (replay-safe), performs a single-transaction buyer debit → seller credit (`computeFees` net) → `seller_earnings` insert, and kill-switches on insufficient funds.
- Session end: `POST /v1/billing/sessions/end {sessionToken}`.

## 4. Marketplace and Relays

- Sellers broadcast a heartbeat (`POST /v1/marketplace/heartbeat`, auth) storing geo + pricing + optional metrics + optional **relay credentials** (`relay.endpoint`, `relay.publicKey`) in Redis (`seller:<id>`, TTL 300s).
- Listings only carry real values. No synthetic price (`0.5`), speed (`50 Mbps`) or stability (`99%`) defaults are stored or returned; a listing without a published price is excluded from search.
- `GET /v1/marketplace/search`, `/v1/marketplace/sellers`, `/v1/marketplace/sellers/:id` return `avg_speed`/`stability`/`relay_endpoint`/`relay_public_key` as nullable fields.
- WireGuard configs are built from the seller's **real registered relay** (`buildVpnConfigFromSeller`). If a provider has no relay registered, session creation fails closed with `409 SELLER_RELAY_NOT_REGISTERED`. There is no invented relay endpoint in the codebase anymore.
- The client-side `Interface.PrivateKey` is a documented sentinel (`[CLIENT-KEY-GENERATED-ON-DEVICE]`): the device substitutes its own generated key at handshake time.

## 5. Integration gaps found on this pass (and fixes)

| # | Gap | Symptom | Fix |
|---|---|---|---|
| A36 | Mobile `Wallet` called `/wallet/*` | 404 against real `/v1/billing/*` routes | Mobile now calls `/billing/balance`, `/billing/transactions`, `/billing/withdraw` |
| A37 | Mobile withdraw body `{ amount }` | Backend requires `amount_usd` + `method` + `phone_number` (400 `PAYMENT_METHOD_REQUIRED`) | Withdraw modal now collects phone; body matches contract |
| A38 | Mobile `Marketplace` posted legacy `/sessions` and used its fabricated config | Usage billing never triggered; fake relay config handed to WireGuard | Connect now uses `/billing/sessions/start`; disconnect calls `/billing/sessions/end`; real per-install `hardwareId` |
| A39 | Mobile/Admin portal admin paths split (`/admin/*` vs `/v1/admin/*`) | One or both 404 | Backend core admin routes dual-mounted under `/admin/*` and `/v1/admin/*` |
| A40 | `/v1/marketplace/sellers` + search fabricated `0.5`/`50`/`99` fallbacks | Fake financial/quality data displayed | Repository + route return real-only values; nulls rendered honestly in clients |
| A41 | `vpn_config` was a hardcoded placeholder (`relay:51820`, `[generated]`) | Tunnel could never establish | Config derived from seller's registered relay; fail closed otherwise |
| A42 | Admin telemetry `total_bandwidth_gb = sessions * 0.25` | Fabricated metric | Computed from `SUM(bytes_used)` of active sessions |
| A43 | Mobile `/users/me/stats` — no backend route | Dead call, fake stats | Real `GET /v1/users/me/stats` (earnings/sessions/is_seller; rating/uptime honestly null) |
| A44 | Profile: hardcoded "ELITE RELAY NODE", "VERIFIED ID", "TOP RATED", "PREMIUM", "Keys Rotated" | Fabricated identity/security claims | Badges from real `is_seller` + `kyc_level`; encrypted-key-rotation surfaced as unavailable; prefs persisted locally with honest labels |
| A45 | Relay screen asserted "hosting active WireGuard tunnels", stability 99, 94.2 Mbps "Fibre" | Fabricated telemetry | Honest ping status; measured/optional speed; real relay endpoint+key registration inputs |
| A46 | buyer-web used seller id as `hardwareId`; unguarded `avg_speed`/`stability` renders | Wrong billing identity; `NaN/undefined` on nulls | Real per-browser device id; null-safe renders/sorts across marketplace + home pages |

## 6. Verified invariants (kept intact)

- Buyer id always taken from the JWT (`sub`), never from request bodies.
- Payment amount/price/per-MB always resolved server-side.
- Stripe webhook requires `stripe-signature`; M-Pesa callback replay-safe; M-Pesa FX default 155 with 5-KES tolerance.
- Admin incidents come from `audit.audit_log`; lockdown is a real global switch + Kafka propagation (in-memory).

## 7. Open / blocked

- **Live Android emulator/E2E**: BLOCKED — no Android SDK, `adb`, emulator, or JVM on the build machine.
- **Live payment (Stripe/M-Pesa)**: NOT CONFIGURED — no live/sandbox credentials in this environment.
- **Live Postgres/Redis run**: NOT VERIFIED — builds and unit tests pass; live integration needs provisioned `DATABASE_URL`/`REDIS_URL`.
- Live relay hardware registration is now supported by the contract (heartbeat relay fields) but no physical relay has been provisioned; buyers will correctly receive `409 SELLER_RELAY_NOT_REGISTERED` until a provider registers one.

## 8. Build verification

- `backend`: `tsc` clean; `npm test` 16/16 pass (fees, cent-carry, OTP lifecycle, admin RBAC).
- `apps/buyer-web`: `next build` passes.
- `apps/admin-portal`: `next build` passes (verified previously this session).
- `apps/mobile-app`: syntax-verified (type-check requires installing Expo deps on a machine with a working RN toolchain).

See `docs/production-audit.md` for the full A1–A46 resolution matrix and `docs/testing/` for verification evidence.