# DRAVIO — Asset Inventory

Code-level inventory of the DRAVIO monorepo (`C:\Users\Admin\Desktop\DRAVIO`, git remote `https://github.com/techi523/DRAVIO.git` per `git remote -v`, HEAD `fed7ec8`). Every claim cites a real path verified against the working tree. Research-only, no code modified. Statuses: `VERIFIED` / `PARTIAL` / `FAILED` / `BLOCKED` / `NOT VERIFIED` / `NOT APPLICABLE` / `LEGAL REVIEW REQUIRED` / `UNCONFIRMED`.

---

## 1. Top-level structure

| Path | Purpose | Status | Evidence |
|---|---|---|---|
| `apps/` | Runtime applications: buyer-web, admin-portal, mobile-app | VERIFIED | `apps/buyer-web`, `apps/admin-portal`, `apps/mobile-app` present |
| `backend/` | Consolidated Fastify backend (replaces 14 legacy microservices) | VERIFIED | `backend/src/index.ts:16-32` (all module imports) |
| `services/` | 14 legacy microservice dirs (13 services + `db`) | PARTIAL | `services/` has admin, analytics, audit, auth, billing, db, fraud-discovery, gateway, isp, marketplace, metering, payment, session, user |
| `packages/` | `e2e-tests` (Playwright), `shared-ts` (orphaned JWT fallback), shared-config | PARTIAL | `packages/e2e-tests/playwright.config.ts`; `packages/shared-ts/src/auth.ts:4` |
| `infra/` | ArgoCD/k8s chart, qa-suite, terraform VPC, stress-engine | PARTIAL | `infra/k8s/argocd/application.yaml` (repo mismatch, see §9); `infra/qa-suite/{db-acid-validator,failure-injection,performance-stress,security-scanner,sre-orch}.ts` |
| `tests/` | Root Playwright spec + suite README | VERIFIED | `tests/e2e.spec.ts:3-26`, `tests/README.md` |
| `docs/` | Security, compliance, operations, testing docs | VERIFIED | 40+ `.md` files |
| `.github/workflows/deploy.yml` | CI/CD: typecheck, unit test, image builds, placeholder staging | VERIFIED | `deploy.yml:13-196` |
| `.neon` | Neon serverless Postgres org/project reference | VERIFIED | `.neon:2-3` (`org-orange-bar-53499555`, `orange-pond-85174786`) |
| `google-services.json` | Firebase config **placeholder (fake keys)** | PARTIAL/FAILED | `apps/mobile-app/google-services.json:23` — `AIzaSyFakeKeyForPlayStoreCompilationOnly_1234` |
| `.env.production.template` | Sole `.env*` file in repo | VERIFIED | glob `**/.env*` → exactly one; values at lines 12/16/51/65 |

---

## 2. Backend (`backend/`)

### 2.1 Runtime facts

- Fastify + `@fastify/jwt`, `cors`, `helmet`, `rate-limit`, `compress`, Socket.IO on one port — `backend/src/index.ts:36-150`.
- Binds `0.0.0.0`, default `PORT 8080` — `backend/src/index.ts:190-191`; `backend/src/config/env.ts:5`.
- Fail-fast: refuses to start without `JWT_SECRET` — `backend/src/index.ts:55-57`; min 32 chars — `env.ts:6`.
- CORS allowlist from `CORS_ORIGINS` **plus any `*.vercel.app` origin** — `backend/src/index.ts:42-52`. Default list is localhost only — `env.ts:9`.
- Global rate limit 200 req/min — `index.ts:73-76`. Helmet on (CSP disabled) — `index.ts:68-71`.
- Health: `GET /` (version 2.0.0, `index.ts:105-110`), `GET /health` (`index.ts:112-117`).
- Module registration: `index.ts:121-131`; background consumers started at `index.ts:206-210`.

### 2.2 Modules (15 route/consumer modules)

| Module | Evidence | Auth/callback notes | Status |
|---|---|---|---|
| auth | `modules/auth/index.ts` | 7 POST flows (register/login/oauth/otp/send,otp/verify/refresh/logout); JWT TTL defaults 900s / 30d — `env.ts:53-54` | VERIFIED |
| users | `modules/users/index.ts` | profile/KYC: `GET/PUT /v1/users/me` only; **no public profile write** | VERIFIED |
| marketplace | `modules/marketplace/index.ts`, `repositories/marketplace.repository.ts` | `POST /v1/marketplace/heartbeat` (SELLER role); seller geo in Redis `active_sellers_geo` — `marketplace.repository.ts:94-96` | VERIFIED |
| session | `modules/session/index.ts`, `access.ts` | `POST /v1/sessions` builds WireGuard from real seller relay — `index.ts:40-89`, `access.ts:28-41`; handoff requires registered relay — `index.ts:122-124` | VERIFIED |
| payment | `modules/payment/index.ts` | Stripe webhook signature-verified (`index.ts:31-62`); **M-Pesa callback unauthenticated, no signature check** (`index.ts:64-80`) | VERIFIED |
| billing | `modules/billing/index.ts`, `core/session-manager.ts` | session start/end authenticated; server-authoritative price — `session-manager.ts:29-33` | VERIFIED |
| isp | `modules/isp/index.ts` | packages/activate/usage routes **unauthenticated** (`index.ts:118-139`); usage webhook HMAC-sha256 verified (`141-161`) | VERIFIED |
| admin | `modules/admin/index.ts` | role-gated telemetry/incidents/lockdown + Socket.IO relay (`42-168`) | VERIFIED |
| compliance | `modules/compliance/index.ts` + `pure/*` | policies public; acceptance authenticated; policy registry — `pure/policy-registry.ts:15-56` | VERIFIED |
| privacy | `modules/privacy/index.ts`, `services/privacy.service.ts` | DSAR workflow; real erasure plan — `privacy.service.ts:84-130` | VERIFIED |
| provider | `modules/provider/index.ts` | `POST /v1/provider/intake` SELLER-gated — `index.ts:11-53` | VERIFIED |
| audit | `modules/audit/index.ts`, `producer.ts` | `dm.audit.log` → `audit.audit_log`; topic at `producer.ts:9` | VERIFIED |
| analytics | `modules/analytics/index.ts` | aggregates only: `total_sessions`/`total_revenue` — `index.ts:19-31` | VERIFIED |
| metering | `modules/metering/index.ts` | `dm.usage.ticks` → Redis `session:<id>:usage` — `index.ts:18-29` | VERIFIED |
| fraud | `modules/fraud/index.ts` | `MULTIPLE_FAILED_PAYMENTS` (failedCount>3), `IMPOSSIBLE_TRAVEL` — `index.ts:12-28` | VERIFIED |
| **network / relay** | *not present* | no dedicated module in `backend/src/modules` | NOT FOUND IN REPO |

### 2.3 Databases / infra clients

| Client | Evidence | Notes |
|---|---|---|
| Postgres `pg` pool | `backend/src/db/client.ts:9-23` | SSL only when `DATABASE_URL && NODE_ENV==='production'`, `rejectUnauthorized:false` — `:5-7`; default DB name **`dravio_production`** — `:17` |
| Redis (ioredis) | `backend/src/db/redis.ts` | degraded mode if `REDIS_URL` unset |
| KafkaJS | `backend/src/events/kafka.ts` | consumers non-fatal if `KAFKA_URL` unset |
| Firebase Admin (env-gated) | `modules/auth/utils/firebase-admin.ts` (grep `FIREBASE_`) | initializes only when 3 `FIREBASE_*` vars set (`env.ts:12-14`) |
| Cloudinary (env-gated) | `modules/users/utils/cloudinary.ts` | `env.ts:17-19` optional; throws FATAL if configured but broken |

### 2.4 Deploy manifests

| Manifest | Target | Evidence | Note |
|---|---|---|---|
| `render.yaml` | Render web service `dravio-backend` + managed `dravio-postgres` (free) | `render.yaml:7-12,92-96` | prod-only; `MPESA_ENV: sandbox` (`:39-40`); `OTEL_*` vars declared but unwired (`:83-86`) |
| `railway.json` | Railway via **legacy** `services/gateway-service/Dockerfile.render` + `start-all.sh` | `railway.json:2-9`; `start-all.sh:13` (`NODE_ENV=production`) | **conflicts** with `railway.toml` (backend monolith) |
| `railway.toml` | Railway single service via `backend/Dockerfile` | `railway.toml` | comment-only env guidance |
| `backend/Dockerfile` | monolith container | present | |

---

## 3. Applications (`apps/`)

### 3.1 buyer-web (Next.js 15)
- API base: `NEXT_PUBLIC_API_URL || (NODE_ENV==='production' ? 'https://api.dravio.com' : 'http://localhost:8080')` — `apps/buyer-web/src/lib/api.ts:7`.
- WS: same fallback — `apps/buyer-web/src/lib/socket.ts:5`.
- Neon auth cookie secret fallback **hardcoded constant** — `src/lib/auth/server.ts:14-17` (`CHANGE_ME_NEON_AUTH_COOKIE_SECRET_AT_LEAST_64_CHARS_LONG`).

### 3.2 admin-portal (Next.js 15)
- API base: `NEXT_PUBLIC_GATEWAY_URL || (...) 'https://api.dravio.com' ...` — `apps/admin-portal/src/lib/api.ts:5`.
- Same hardcoded Neon cookie fallback — `src/lib/auth/server.ts:14-17`.

### 3.3 mobile-app (React Native / Expo 55)
- App identity: slug `dravio`, bundle `com.dravio.app`, updates `https://u.expo.dev/dravio-mobile-app`, intent host `dravio.app`, `usesCleartextTraffic:false` — `apps/mobile-app/app.json:4,16,28,32,57,85`.
- EAS: dev/preview/production; **only `production` carries a URL** `EXPO_PUBLIC_API_URL: https://api.dravio.app/v1`, channel `production` — `apps/mobile-app/eas.json:20-26`.
- API resolution: `__DEV__` → `http://10.0.2.2:8080/v1` (emulator) / LAN / localhost; else `EXPO_PUBLIC_API_URL`; throws if unset — `apps/mobile-app/src/services/api.ts:17-44`.
- WireGuard client dep `react-native-wireguard-vpn` and `expo-secure-store` — `apps/mobile-app/package.json:31,44`.

---

## 4. Legacy services (`services/`)

14 dirs: admin, analytics, auth, billing, db, fraud-discovery, gateway, isp, marketplace, metering (Go), payment, session (Go), user. Monolith commit claims consolidation — `05a4438 "feat: consolidate 14 microservices into single backend service"`.

| Service | Evidence | Flag |
|---|---|---|
| gateway-service | CORS allowlist + `*.vercel.app` wildcard — `services/gateway-service/src/index.ts:35-48,251-267`; JWT required `:30-31` | wildcard CORS |
| admin-service | `CORS_ORIGINS` fallback **`true` (allow-all)** — `services/admin-service/src/index.ts:39`; Socket.IO `origin: '*'` — `:207` | open CORS in legacy plane |
| auth/user/payment/billing/marketplace | all fail-fast without `JWT_SECRET` (e.g. `services/payment-service/src/index.ts:25-31`) | OK |
| session (Go) | built in render image — `services/gateway-service/Dockerfile.render:64-71,104-105` | — |
| metering (Go) / analytics (Python) | compose services — `docker-compose.yml:??` | — |

---

## 5. Infrastructure & CI/CD

- CI: `deploy.yml` — typecheck 7 services (`:29-48`), unit test billing with committed `JWT_SECRET: test-only-secret-do-not-use-in-production` (`:69`), build/images 14 services + 2 frontends to `ghcr.io` (`:71-180`), `deploy-staging` is a **no-op echo placeholder** (`:182-196`).
- ArgoCD: `infra/k8s/argocd/application.yaml:9` → `repoURL: https://github.com/dravio/platform.git` — **mismatch** with git origin `techi523/DRAVIO.git`. Target namespace `dravio-prod`, auto-prune/self-heal (`:13-18`).
- qa-suite present: `infra/qa-suite/{db-acid-validator,failure-injection,performance-stress,security-scanner,sre-orch}.ts`.
- Terraform: `infra/terraform/modules/vpc/main.tf`.

---

## 6. Local tooling / compose (`docker-compose.yml`)

- Postgres `dravio_production` default DB (`docker-compose.yml:11`), Redis, Zookeeper, Kafka **PLAINTEXT/no auth** (`:282-284`), topic init `kafka-setup` (`:287-300`: `dm.auth.user_registered`, `dm.session.started`, `dm.session.completed`, `dm.payment.completed`, `dm.metering.update`).
- All service `DATABASE_URL` use `POSTGRES_DB:-dravio_production` (e.g. `:86,97,120`).
- **MongoDB container** `mongo:6.0` — `docker-compose.yml:302-312` (root creds required, volume `mongodb_data`). **No backend/app consumer exists** (grep `mongodb|mongoose` in `backend/src` and `apps` → zero).
- **WireGuard container** `lscr.io/linuxserver/wireguard` — `docker-compose.yml:314-336` (NET_ADMIN, `51820/udp`, `ALLOWEDIPS 0.0.0.0/0`). No code in the monolith provisions peers against this container.
- Dev script secrets: `start_local_dev.ps1:4-6` hardcodes `JWT_SECRET=dRaViO_pRoDuCtIoN_sEcReT...` and `DATABASE_URL=...dravio_production`.
- Local dev document: `docs/testing/DB_WSL_DOCKER_SETUP.md:28,39` also directs `dravio_production` for local runs.

---

## 7. Frontend/feature flags environment precedence

Single pattern everywhere (no staging branch): `process.env.NODE_ENV === 'production' ? URL_PROD : URL_LOCAL`. Web: `api.ts:7`/`socket.ts:5`. Mobile: `__DEV__` block then `EXPO_PUBLIC_API_URL` (`api.ts:17-44`) — prod URL only via EAS build (`eas.json:24`).

## 8. Statuses summary

| Category | Status |
|---|---|
| Backend monolith assets | VERIFIED |
| MongoDB / WireGuard containers | VERIFIED container, no consumers (NOT APPLICABLE as runtime deps) |
| Network/relay modules | NOT FOUND IN REPO (logic lives in session/marketplace) |
| Staging environment | NOT PRESENT (no staging config anywhere) |
| Live prod hosts (`api.dravio.com` vs `api.dravio.app`) | NOT VERIFIED / UNCONFIRMED |
| ArgoCD repo URL | FAILED (mismatch `dravio/platform.git`) |
| Firebase `google-services.json` | PARTIAL/FAILED (fake key) |

## 9. Key findings (pointers to deliverable docs)

- Wildcard CORS `*.vercel.app` — backend `index.ts:48`, gateway `index.ts:41,257`, admin-service allow-all `index.ts:39`.
- Two prod API hostnames — web `api.dravio.com` vs mobile `api.dravio.app` (`eas.json:24`), tests `tests/e2e.spec.ts:5` vs `tests/README.md:18`.
- M-Pesa callback unauthenticated — `payment/index.ts:64-80`.
- No analysable prod/staging separation — see `ENVIRONMENT_SEPARATION.md`.
- Data flows — see `DATA_LINEAGE.md`.