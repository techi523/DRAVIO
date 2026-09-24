# DRAVIO — Environment Separation Audit

Engineering audit of how dev/test/staging/production environments are defined, isolated, and prevented from leaking into each other. Research-only; every claim cites a verified path. Statuses: `VERIFIED` / `PARTIAL` / `FAILED` / `BLOCKED` / `NOT VERIFIED` / `NOT APPLICABLE` / `LEGAL REVIEW REQUIRED` / `UNCONFIRMED`.

---

## Q1. Are environments documented and configuration-driven?

**Status: PARTIAL / FAILED-as-is.** Nominal env names exist; no re-producible staging; prod is the only first-class environment.

- `NODE_ENV` accepts only `development | production | test` — `backend/src/config/env.ts:4`. **No `staging` value.**
- Only one `.env*` file in the repo: `.env.production.template`. No `.env.development`, `.env.staging`, `.env.test`. (glob `**/.env*` → exactly one file)
- All deployment manifests are production-only:
  - Render single web service `dravio-backend`, `NODE_ENV: production` — `render.yaml:15-16`; managed DB `dravio_production` — `render.yaml:92-96`.
  - Railway single-service (monolith `railway.toml`) plus a conflicting legacy single-container `railway.json` (gateway Dockerfile.render) — `railway.json:2-9`, `start-all.sh:13` (`NODE_ENV=production`).
  - `deploy-staging` job is a **no-op / commented placeholder** — `.github/workflows/deploy.yml:182-196` (echo only; kubectl line commented `:194-196`).
- Frontend env selection is binary only: `NODE_ENV === 'production'` ? prod URL : localhost — `apps/buyer-web/src/lib/api.ts:7`, `apps/admin-portal/src/lib/api.ts:5`. No preview/staging URL branch.
- Mobile EAS has dev/preview/production profiles, but only `production` carries a real URL — `apps/mobile-app/eas.json:20-26`; preview is still an internal APK build without staging backend.

**Verdict:** FAILED for any env-separation requirement that needs a staging/QA tier. There is no environment that is "like prod but not prod".

---

## Q2. Can one environment's assets reach / fail over to another?

**Status: FAILED.** Multiple concrete cross-env leak paths:

1. **Two production API hostnames hardcoded for the same backend.**
   - buyer-web prod fallback / WebSocket: `https://api.dravio.com` — `apps/buyer-web/src/lib/api.ts:7`, `apps/buyer-web/src/lib/socket.ts:5`.
   - admin-portal prod fallback: `https://api.dravio.com` — `apps/admin-portal/src/lib/api.ts:5`.
   - mobile prod (EAS): `https://api.dravio.app/v1` — `apps/mobile-app/eas.json:24`.
   - Test docs also reference `api.dravio.app` — `tests/README.md:18`. If both are live, web talks to one backend and mobile to another (`UNCONFIRMED` which is authoritative).
2. **`*.vercel.app` wildcard CORS.** Any Vercel preview/PR/branch deploy of buyer-web or admin-portal (any environment, any owner) can call the production backend; backend also cannot distinguish prod vs preview origins — `backend/src/index.ts:46-52`. Same wildcard on the legacy gateway (HTTP `index.ts:41` and Socket.IO `:257`).
3. **Legacy admin-service allows ALL origins by default.** `CORS_ORIGINS` unset → `origin: true` (reflect any) — `services/admin-service/src/index.ts:39`; Socket.IO `origin: '*'` — `:207`.
4. **Sandbox→production payment fail-over is silent.** `MPESA_ENV` defaults to `sandbox` — `backend/src/config/env.ts:26`; M-Pesa provider base URL falls back to `sandbox.safaricom.co.ke` — `backend/src/modules/payment/providers/mpesa.provider.ts:3-6`. Render explicitly pins `MPESA_ENV: sandbox` — `render.yaml:39-40`. A production deploy that omits these silently runs against the sandbox.
5. **Dev database shares the production database name `dravio_production`.**
   - Pool default DB name — `backend/src/db/client.ts:17`.
   - docker-compose `POSTGRES_DB` default — `docker-compose.yml:11` (and every service `DATABASE_URL` `...dravio_production` — e.g. `:86,97,120`).
   - Dev script `DATABASE_URL=...localhost:5432/dravio_production` — `start_local_dev.ps1:6`.
   - Local-run doc same — `docs/testing/DB_WSL_DOCKER_SETUP.md:28,39`.
   - There is no `dravio_dev`/`dravio_test` default anywhere.
6. **Shared static Neon cookie secret fallback** identical in both web apps — `apps/buyer-web/src/lib/auth/server.ts:14-17` and `apps/admin-portal/src/lib/auth/server.ts:14-17`. Any env that doesn't inject the real secret (preview builds, local) uses the same public value in both apps.
7. **Orphaned shared-JWT fallback `'super-secret'`** — `packages/shared-ts/src/auth.ts:4`. No importer found (grep `@dravio/shared-ts` in `*.ts` → none), but it is a trap if a service adopts the package and forgets `JWT_SECRET`.

---

## Q3. Is there a single source of truth for environment/variables?

**Status: FAILED.** At least four overlapping sources disagree:

| Source | Defines | Conflict |
|---|---|---|
| `backend/src/config/env.ts:3-58` (zod) | defaults: CORS localhost trio (`:9`), MPESA sandbox (`:26`), USD_TO_KES 155 (`:34`), fee 0.20 (`:50`), JWT TTLs 900/2592000 (`:53-54`), Stripe checkout `https://checkout.dravio.com` (`:57`) | defaults ≠ manifest values |
| `.env.production.template` | `DATABASE_URL` **`CHANGE_ME.railway.internal`** (`:12`), `JWT_SECRET CHANGE_ME` (`:16`), `MPESA_CALLBACK_URL` (**`railway.app`**, `:51`), CORS Vercel list (`:65`) | template assumes Railway; render.yaml is Render; MPESA_ENV not pinned here |
| `render.yaml` | NODE_ENV prod (`:15-16`), JWT `generateValue` (`:20-21`), CORS Vercel list (`:32-33`), **MPESA_ENV: sandbox** (`:39-40`), ISP/Firebase/Cloudinary/Twilio sync:false, **OTEL_* (`:83-86`)** | MPESA sandbox vs `.env.production.template` "production" guidance; OTEL vars have no instrumentation |
| `railway.json` / `railway.toml` / `start-all.sh` | Dockerfile.render all-in-one container (`railway.json:2-9`), starts 8 services with `NODE_ENV=production` (`start-all.sh:13`) | contradicts `railway.toml` (backend monolith); start-all.sh starts session-service at 3015 (`start-all.sh:49-53`) which `session-manager.ts` doesn't use |

- Frontend env var name differs per app for the same semantic: `NEXT_PUBLIC_API_URL` (buyer-web) vs `NEXT_PUBLIC_GATEWAY_URL` (admin-portal) vs `EXPO_PUBLIC_API_URL` (mobile).
- OTEL: `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_SERVICE_NAME` declared in `render.yaml:83-86`; **zero** `opentelemetry` usage in `backend/src` (grep) — dangling config.

---

## Q4. Are environment secrets/credentials separated?

**Status: PARTIAL/FAILED.**

Good:
- `JWT_SECRET` mandatory at boot — `backend/src/index.ts:55-57`; min-32 validation — `env.ts:6`. Render `generateValue: true` (`render.yaml:20-21`); all real provider secrets are `sync:false` (`render.yaml:23-81`). No `.env` committed. No `sk_live_`/MPESA consumer-key strings in source.

Bad:
- Committed/hardcoded secret material:
  - Dev script JWT secret (production-labelled) — `start_local_dev.ps1:4` (`dRaViO_pRoDuCtIoN_sEcReT_kEy_2026_xYz_9876543210_vPn_MaRkEtPlAcE`).
  - CI test JWT secret — `.github/workflows/deploy.yml:69`.
  - Unit-test JWT secret — `backend/tests/helpers/test-app.ts:10`.
  - Shared-ts `'super-secret'` fallback — `packages/shared-ts/src/auth.ts:4`.
  - Neon cookie-secret fallback (public literal) — both `*/src/lib/auth/server.ts:14-17`.
  - Firebase placeholder key — `apps/mobile-app/google-services.json:23`.
- `.env.production.template:12` ships a `CHANGE_ME` credential template for `railway.internal` — safe placeholder, but is the *only* committed DB reference and hardcodes the prod db name.
- Test/coupling note: `M-Pesa` and `Stripe` secrets are optional (`env.ts:22-31`); a prod API reachable without them runs with payment badly degraded rather than fail — payment endpoints still return checkout errors at runtime (`render.yaml:35-48` sync:false).

---

## Q5. Is test execution isolated from production?

**Status: FAILED for E2E; PARTIAL for unit/integration.**

Isolated (good):
- Backend unit tests target pure logic offline (`backend/tests/*`, e.g. `helpers/test-app.ts`, compliance/money/rbac suites); `test:unit` runs via `package.json:12`.

Not isolated (defaults hit production):
- Root Playwright suite **defaults to production URLs** and asserts live prod health:
  - `tests/e2e.spec.ts:3-5` — `BUYER_URL` default `https://buyer-web-henna.vercel.app`, `ADMIN_URL` default `https://admin-portal-weld-seven.vercel.app`, `API_URL` default `https://api.dravio.com`; `:21-26` asserts `GET https://api.dravio.com/health → 200`. No guard rejects production targets — running the repo's e2e as-is is a production smoke test.
- `packages/e2e-tests/tests/auth.spec.ts:53-58` watches `identitytoolkit`/`/api/` calls; baseURL defaults to `http://localhost:3000` — `packages/e2e-tests/playwright.config.ts:12` (local default, but run via `npm run test:e2e-web` uses `package.json:20` with the same file).
- Integration suite is documented as requiring `backend/.env` (`DATABASE_URL`, `REDIS_URL`) and a reachable `127.0.0.1:8080` **or** `api.dravio.app` — `tests/README.md:18`. So "integration" can silently target the live host.
- Local DB/Redis used for tests share **prod-named** schema (`docs/testing/DB_WSL_DOCKER_SETUP.md:28,31-39`) — a schema drift between test-local and prod is the only isolation in practice.

**Cross leak:** unauthenticated **M-Pesa callback** — `backend/src/modules/payment/index.ts:64-80` — accepts a POST with only schema validation and completes a PENDING transaction on amount match (`payment.service.ts:100-139`, tolerance ±5 KES `:115-122`). A test harness (or attacker) that knows a PENDING transaction's `provider_ref` can mark it completed without actual money movement. Replay-safe (state machine ignores non-PENDING: `:111-113`) and amount-reconciled, but **no auth/signature** — unlike the Stripe webhook (`index.ts:36-61`).

---

## Q6. Can we audit which environment is deployed where?

**Status: FAILED / NOT VERIFIED.**

- No tracing/observability agent in `backend/src` (grep `opentelemetry|sentry|posthog|datadog` → zero); `render.yaml:83-86` OTEL vars are unwired.
- `/health` (`index.ts:112-117`) and `/` version 2.0.0 (`index.ts:105-110`) do not identify the host/environment.
- Corrections from earlier write-ups that are **not** reprogrammable: none — state is that `api.dravio.com` and `api.dravio.app` coexist in source and cannot be consolidated without live inspection (`UNCONFIRMED`).
- CI only builds images; deploy to anywhere (Render/Railway/Vercel/GHCR consumers) happens outside this repo. ArgoCD manifest points at a **different repository** (`infra/k8s/argocd/application.yaml:9` → `dravio/platform.git` vs origin `techi523/DRAVIO.git`) so even the declared deploy target is broken/divergent.

---

## Consolidated answers (6)

| # | Question | Verdict | Blocks |
|---|---|---|---|
| Q1 | Documented, config-driven envs | FAILED-as-is (no staging tier; prod-only manifests) | `env.ts:4`; `deploy.yml:182-196`; `render.yaml:15-16` |
| Q2 | No cross-env reach/fail-over | FAILED | `index.ts:46-52` CORS wildcard; `env.ts:26` MPESA sandbox default; `client.ts:17`/`start_local_dev.ps1:6` prod DB name; shared cookie secrets |
| Q3 | Single source of truth | FAILED | `env.ts` vs `.env.production.template` vs `render.yaml` vs `railway.json`/`start-all.sh` |
| Q4 | Secret/credential separation | PARTIAL/FAILED | committed/test/persistent secrets & placeholders (see Q4) |
| Q5 | Test isolation from prod | FAILED (E2E hits prod by default) | `tests/e2e.spec.ts:3-5`; `payment/index.ts:64-80` unauthenticated callback |
| Q6 | Deployed-env observability | FAILED / NOT VERIFIED | no tracing; `/health` insufficient; ArgoCD wrong repo |

Severity-ranked findings: see companion `ASSET_INVENTORY.md` §9 and reply summary.