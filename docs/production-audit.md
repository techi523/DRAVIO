# DRAVIO Production Audit

Date: 2026-09-20
Auditor: automated deep-inspection (opencode)
Scope: full monorepo

## Current Architecture

- Single consolidated **Fastify backend** (`backend/`) replacing 14 microservices; legacy microservice trees remain under `services/*` (unused by the deployed backend).
- Next.js frontends: `apps/buyer-web` (buyer marketplace), `apps/admin-portal` (admin dashboard).
- Expo React Native app: `apps/mobile-app`.
- PostgreSQL (consolidated schema in `master_init.sql`), Redis (session + marketplace cache), optional Kafka (events), Stripe + M-Pesa (payments), Twilio (OTP), Firebase (social auth), Cloudinary (uploads).
- Deploy targets referenced: Railway (railway.json/railway.toml), Render (render.yaml), GHCR images via GitHub Actions.
- Monorepo uses npm workspaces (`services/*`, `apps/*`, `packages/*`).

## Verification environment

- Node v24.18.0, npm 11.16.0. No lockfile present; no node_modules.

## Detected Problems

| # | Severity | Component | Root cause | Proposed fix | Verification |
|---|----------|-----------|------------|--------------|--------------|
| A1 | CRITICAL | `backend/src/modules/admin/middleware/rbac.ts:9-16` | Unauthenticated requests are fabricated into `SUPER_ADMIN` (`dev-admin-id`); no JWT verification runs before `requireRoles` | Require `jwtVerify()` in `requireRoles`, reject 401 when no user; remove fabrication | Send unauthenticated request to `/admin/telemetry` -> 401 |
| A2 | CRITICAL | `backend/src/modules/auth/schema/auth.schema.ts:8` | Public register allows `role: 'ADMIN'` | Remove `ADMIN` from register enum; server derives roles | Register with role=ADMIN -> rejected |
| A3 | CRITICAL | `backend/src/modules/auth/services/otp.service.ts:25-29` | OTP verify accepts code `123456` for any phone when Twilio not configured | Remove universal fallback; enable mock only in `NODE_ENV=test`; require Twilio config in production for OTP login | Verify OTP with 123456 -> rejected in dev/prod |
| A4 | CRITICAL | `backend/src/modules/users/repositories/user.repository.ts:58-79` | Dynamic SQL `SET` clause built from raw body keys (column-name SQL injection / unfiltered update) | Use fixed whitelist field map in `update()` | Fuzz body keys -> only whitelisted columns updated |
| A5 | CRITICAL | `backend/src/modules/auth/index.ts:20,48,70,114` + `backend/src/index.ts:75` | JWTs issued with no expiry; `/v1/auth/refresh` re-signs any still-valid access token; no revocation | Add `expiresIn: 15m`; real refresh-token store already schema'd (`auth.refresh_tokens`); add logout/revoke | Decode token -> has `exp`; refreshed token valid |
| A6 | CRITICAL | `backend/src/modules/payment/index.ts:24-42` | Webhook endpoint unauthenticated; `event`+`provider_ref` client-supplied; `verifyWebhookSignature` never called | Raw-body signature verification against Stripe webhook secret; map verified `payment_intent.id` only | Forged webhook payload -> 400; valid signature -> processed |
| A7 | CRITICAL | `backend/src/modules/payment/index.ts:44-52` + `payment.service.ts:71-98` | M-Pesa callback forgeable (no credential/amount reconciliation) | Reconcile callback amount vs transaction; guard `status='PENDING'` transitions | Forged callback -> rejected; mismatched amount -> 400 |
| A8 | CRITICAL | `backend/src/modules/billing/api/routes/wallet.routes.ts:23-35` | `/v1/billing/topup` credits wallet from client amount with zero payment linkage (money printer) | Remove free-credit route; credit wallet only inside verified payment completion path | POST topup -> 404/403; completed verified payment credits wallet |
| A9 | CRITICAL | `backend/src/modules/payment/index.ts:74-97` | `/v1/payments/wallet/deduct` unauthenticated, deducts arbitrary user's wallet | Require auth; derive userId from token; restrict to self / internal callers only | Unauthenticated deduct -> 401 |
| A10 | CRITICAL | `services/payment-service/src/services/mpesa.service.ts:12-16` | Hardcoded M-Pesa sandbox credentials/URLs in committed service code (duplicate microservice) | Remove fallback credentials; require env vars; delete duplicate service tree or mark deprecated | Grep for literals -> absent |
| A11 | HIGH | `backend/src/modules/users/index.ts:7-20` | `POST /v1/users` unauthenticated profile-write backdoor | Remove route (profiles auto-created on register) | Unauthenticated POST -> 404 |
| A12 | HIGH | `backend/src/modules/users/index.ts:37-53` | `PUT /v1/users/me` mass assignment (is_seller, kyc_level, auth_user_id, id) | Strict `UpdateProfileSchema` whitelist | Update profile with role fields -> ignored |
| A13 | HIGH | `backend/src/modules/payment/repositories/payment.repository.ts:45-59` | Unconditional status transitions; replay flips FAILED->COMPLETED; duplicate events | `WHERE status='PENDING'` guards; publish only on real transition | Replay webhook -> no duplicate events |
| A14 | HIGH | `backend/src/modules/payment/index.ts:54-72` | Payment status IDOR (any payment id readable) | Scope query by authenticated `user_id` | User B reads A's payment -> 404 |
| A15 | HIGH | `backend/src/modules/payment/schema/payment.schema.ts` | Amount/currency validation gaps; CRYPTO branch orphans transactions | Add max/`multipleOf(0.01)`/currency enum; remove CRYPTO | Extreme amounts rejected |
| A16 | HIGH | `backend/src/modules/billing/core/session-manager.ts` + `session.routes.ts:8,12` | Client controls `pricePerMb`/`sellerId`; billing decoupled from listing | Resolve price server-side from seller listing (Redis) | Tampered price -> rejected |
| A17 | HIGH | `backend/src/modules/billing/core/engines/byte-tracker.ts` | Deduct + seller credit + earnings not transactional; dual billing paths can double-deduct; no usage idempotency | Single DB transaction; delta-based usage billing | Concurrent usage updates -> no double bill |
| A18 | HIGH | `backend/src/modules/session/index.ts:20-53` | `/v1/sessions` unauthenticated, arbitrary buyer/seller, fake relay config | Require auth; derive buyer from token; validate seller | Unauthenticated -> 401 |
| A19 | HIGH | `backend/src/modules/marketplace/index.ts:49-62` | `GET /v1/marketplace/sellers/:id` full-dataset scan from (0,0) | Redis `hgetall(seller:<id>)` direct lookup | Lookup by id returns only that seller |
| A20 | HIGH | `apps/admin-portal/src/app/(dashboard)/compliance/page.js` | Duplicate compiled artifact breaks `next build` | Delete file | `next build` succeeds |
| A21 | HIGH | `apps/{buyer-web,admin-portal}/src/app/auth/[path]/page.tsx:3` | `dynamicParams=false` with no `generateStaticParams` -> all `/auth/*` 404 | Remove `dynamicParams=false` | `/auth/sign-in` resolves |
| A22 | HIGH | `apps/admin-portal/src/components/SOCPanel.tsx:15`, `RuleEngineUI.tsx:16,25` | Hardcoded `127.0.0.1:3008` bypass admin auth | Route via env-based API client | No localhost in prod build |
| A23 | HIGH | `apps/admin-portal/src/middleware.ts:8` | Matcher never matches real routes; login page role check client-side only | Fix matcher; server-side session/role checks | `/` protected |
| A24 | HIGH | `apps/mobile-app` | No OTA update pipeline (`expo-updates` absent, no updates URL, non-UUID projectId) | Install `expo-updates`, configure `updates.url` + runtimeVersion + channel | EAS update emission works |
| A25 | MEDIUM | `backend/src/config/env.ts:50` + `byte-tracker.ts:25` | Platform fee default 0.10 vs spec 20%; fee not applied at payment completion | Single source of truth `PLATFORM_FEE_PCT=0.20`, computed at completion | Transactions store fee+net |
| A26 | MEDIUM | `backend/src/db/client.ts:5-7` | `ssl.rejectUnauthorized:false` in production | Verify server CA where possible; keep as explicit opt-in | Config documented |
| A27 | MEDIUM | `apps/mobile-app/app.json:76` | `usesCleartextTraffic:true` globally incl. production | Production cleartext off | Manifest for prod has cleartext off |
| A28 | MEDIUM | `apps/mobile-app/src/mocks/wireguard-mock.js`, `TunnelMonitor` stubs, dead `metro-resolver` dep, placeholder `google-services.json`, missing `play-store-key.json` | Mobile build/hygiene issues | Declare deps, remove stubs, gitignore real credentials | Grep checks |
| A29 | MEDIUM | `backend/src/modules/fraud/index.ts:66-83` | `/v1/internal/*` unauthenticated | Require internal service auth | Unauthenticated -> 401 |
| A30 | MEDIUM | Duplicate service trees `services/*-service`, `koyeb.zip`, `scratch.js`, `fetch-*.js`, `logcat.txt`, compiled `.js` artifacts | Repo hygiene / drift | Remove or gitignore duplicate artifacts | `next build` unaffected |
| A31 | LOW | All apps | No lockfile (`.gitignore` ignores it) | Generate + commit `package-lock.json` | `npm ci` succeeds |
| A32 | LOW | Privacy | buyer-web has no privacy policy page/route | Add `/privacy` page + footer link | Page reachable |
| A33 | LOW | `backend/src/modules/auth/middleware.ts` / `security.ts` | `authorize()` and risk scoring dead code | Wire or remove | Grep |
| A34 | LOW | Payment-credit path | `dm.payment.completed` has no consumer that credits seller/buyer wallets | Wire payment completion -> wallet credit inside DB tx | E2E purchase -> wallet credited |

## Highest-risk failures (fix order)

1. A1 Admin RBAC bypass (full unauth admin).
2. A6/A7 Payment forgery (free access without payment).
3. A8/A9 Free money / arbitrary wallet drain.
4. A2/A3/A4/A5 Auth: privilege escalation, OTP bypass, SQLi, no expiry.
5. A11/A12/A14 Profile/IDOR/mass assignment.
6. A13/A15 Payment state machine + validation.
7. A16/A17 Billing trust & idempotency.
8. A20/A21 Build blockers.
9. A18/A19 Session & marketplace.
10. Billing fee enforcement (A25).

## Architecture sanity checks

- Buyer -> Mobile/Web -> Gateway/API -> Auth -> Marketplace -> Payment -> Transaction -> Connectivity auth -> Network/relay -> Internet: backed by `/v1/auth`, `/v1/marketplace`, `/v1/payments`, `/v1/billing/sessions`, `/v1/sessions`. Auth/authorization separation is implemented but **authorization is broken** (A1).
- Separation of concerns between auth, billing, payment, admin, marketplace is present in module layout; enforcement was missing.

## Resolution status (2026-09-20, this hardening pass)

| # | Status | Fix | Verification |
|---|--------|-----|--------------|
| A1 | FIXED | `requireRoles` runs `jwtVerify()`; fabrication removed | test: unauth `/admin/telemetry` -> 401 |
| A2 | FIXED | register role enum BUYER/SELLER; servers derive roles | test: role=ADMIN register rejected |
| A3 | FIXED | random OTP (test-only mock), rate-limits, Twilio required in prod | test: 123456 rejected; 5-try lockout |
| A4 | FIXED | whitelist column map in `update()` | tests/schema strict |
| A5 | FIXED | access `exp`, hashed refresh tokens, rotation, logout revoke | tests pass |
| A6 | FIXED | raw-body Stripe signature verify; verified PaymentIntent only | webhook manual review |
| A7 | FIXED | M-Pesa callback amount reconciliation + PENDING guard | service review |
| A8 | FIXED | topup removed -> 409; credit only via completion tx | route code + test |
| A9 | FIXED | wallet/deduct auth + token-derived user | code review |
| A10 | FIXED | env-only creds; hardcoded fallbacks removed | grep clean |
| A11 | FIXED | `POST /v1/users` removed | grep + build |
| A12 | FIXED | strict whitelist schema | tests |
| A13 | FIXED | PENDING-guarded transitions; event only on real transition | code review |
| A14 | FIXED | `findOwnedById(id, userId)` | test |
| A15 | FIXED | amount<=100000, multipleOf(0.01), currency/method enums, CRYPTO dropped | tests |
| A16 | FIXED | server-side price from listing; sellerId validated | code review |
| A17 | FIXED | atomic deduct+credit+earnings in one tx; delta committed bytes; cent carry | tests |
| A18 | FIXED | auth required; buyer from token; owner scoping | tests |
| A19 | FIXED | `hgetall(seller:<id>)`; capped `/sellers` (100) | code review |
| A20 | FIXED | compiled `page.js` deleted | `next build` OK |
| A21 | FIXED | `dynamicParams=false` removed (4 pages) | `/auth/*` resolves |
| A22 | FIXED | SOCPanel/RuleEngineUI via `@/lib/api` env base URL | grep no localhost |
| A23 | FIXED | middleware matcher fixed; server-side session check | build + routes |
| A24 | FIXED | expo-updates `~55.0.22`, updates.url, fingerprint runtime, eas.json | config + app.json |
| A25 | FIXED | `PLATFORM_FEE_PCT=0.20` single source; fee at completion | money tests |
| A26 | RESOLVED | documented opt-in; prod points at real CA | env docs |
| A27 | FIXED | `usesCleartextTraffic:false` for production build | app.json |
| A28 | PARTIAL | placeholders replaced; mock/stub removal deferred to store release | gitignore + grep checks |
| A29 | FIXED | `/v1/internal/*` requires ADMIN/SUPER_ADMIN | test 401 |
| A30 | PARTIAL | duplicate service trees retained but deprecated (README marker); loose files removed | git status |
| A31 | PARTIAL | `backend/package-lock.json` generated; apps installed via npm install; root lockfile pending | `npm ci` on backend, `npx ci` on both apps OK |
| A32 | FIXED | `/privacy` page + footer link | route builds |
| A33 | RESOLVED | removed audit/RBAC dead branches | build clean |
| A34 | FIXED | payment completion -> transaction-scoped wallet credit + ledger insert | transaction + tests |
| A35 | FIXED (new) | `admin-portal/.babelrc` (`next/babel`) forced Babel → broke SWC static analysis of `@neondatabase/auth-ui` ESM barrel ("module has no exports", chunk MODULE_NOT_FOUND). Removed `.babelrc`, migrated Neon imports to recommended `@neondatabase/auth-ui` entry, wrapped provider in a `"use client"` component | `next build` (admin-portal) succeeds |
| A36 | FIXED (new) | Mobile `Wallet` called `/wallet/*` — 404 vs real `/v1/billing/*` routes | routes now `/billing/balance`, `/billing/transactions`, `/billing/withdraw` |
| A37 | FIXED (new) | Mobile withdraw body `{ amount }` — backend requires `amount_usd`+`method`+`phone_number` (400 `PAYMENT_METHOD_REQUIRED`) | withdraw modal collects phone; body matches contract |
| A38 | FIXED (new) | Mobile `Marketplace` posted legacy `/sessions` with fabricated config — usage billing never ran; fake relay handed to WireGuard | connect = `/billing/sessions/start` (server-resolved price), disconnect = `/billing/sessions/end`, real per-install `hardwareId` |
| A39 | FIXED (new) | Admin core routes only at `/admin/*` vs portal/mobile expecting `/v1/admin/*` (or vice versa) — 404 on one side | admin core dual-mounted `/admin/*` + `/v1/admin/*` |
| A40 | FIXED (new) | `/v1/marketplace/sellers` + search fabricated fallbacks `0.5`/`50`/`99` | repository + routes return real-only values; nulls rendered honestly |
| A41 | FIXED (new) | `vpn_config` hardcoded placeholder (`relay:51820`, `[generated]`, `[relay-public-key]`) | config from seller registered relay; fail closed `SELLER_RELAY_NOT_REGISTERED` |
| A42 | FIXED (new) | Admin telemetry `total_bandwidth_gb = activeSessions * 0.25` fabricated | `SUM(bytes_used)/1024^3` of ACTIVE sessions |
| A43 | FIXED (new) | Mobile `/users/me/stats` — no backend route, dead call, fake stats | real `GET /v1/users/me/stats`; rating/uptime honestly null |
| A44 | FIXED (new) | Profile hardcoded "ELITE RELAY NODE", "VERIFIED ID", "TOP RATED", "PREMIUM", "Keys Rotated" | real `is_seller`/`kyc_level` badges; key rotation surfaced unavailable; prefs persisted locally |
| A45 | FIXED (new) | Relay screen asserted active tunnels, stability 99, 94.2 Mbps "Fibre" | honest ping status; measured/optional speed; real relay endpoint+key registration |
| A46 | FIXED (new) | buyer-web used seller id as `hardwareId`; unguarded `avg_speed`/`stability` renders → NaN/undefined | real per-browser device id; null-safe renders/sorts (marketplace + home) |

Notes:
- Backend `npm run build` (tsc) clean; `npm test` = 16/16 pass.
- `apps/buyer-web` and `apps/admin-portal` `next build` both pass under SWC.
- Both apps added `next.config.js` with `transpilePackages: ['@neondatabase/auth', '@neondatabase/auth-ui']` for parity.