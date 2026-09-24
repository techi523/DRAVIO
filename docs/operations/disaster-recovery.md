# DRAVIO Disaster Recovery & Failure Simulation Matrix

Owner: platform engineering. Companion docs: `runbook.md`, `backups.md`,
`monitoring-alerts.md`.

## How to read this document

- **OBSERVABLE** = what a user or operator sees first.
- **SYSTEM BEHAVIOR** = what the code actually does (cited where possible).
- **RISK** = business consequence, stated honestly (no real money movement is a
  material mitigant: payouts are rows-only, M-Pesa is sandbox, Stripe is
  contract-dependent).
- **MITIGATION ALREADY PRESENT** = coded behaviour, with citation.
- **GAP** = what must be built.
- **RTO/RPO** = **ESTIMATE only**. Methodology for the estimate: DRAVIO has no
  SLOs, no monitored telemetry, no backup mechanism; figures below are planning
  targets derived from the documented run steps in `runbook.md`, the current
  absence of backups, and the recommendation that a target should be smaller
  than the time it takes to materially damage trust. They are NOT measured
  values and MUST NOT be shown to customers or regulators as commitments.
  Re-baseline once alerting + backups exist.

Global deployment reality: two manifests diverge (`render.yaml` single web
service; `railway.json` multi-service via `start-all.sh`). Which platform is
live cannot be proven from the repo. Per-platform recovery steps in this matrix
are therefore generic — no cloud network topology is asserted.

---

## P0 conclusion — database is the coordination point, restore is blocker #1

- All durable state funnels through one PostgreSQL instance: `auth.*`,
  `users.*`, `payments.*`, `billing.*`, `sessions.*`, `analytics.*`,
  `audit.audit_log`, `compliance.*` (`master_init.sql:3-9` creates the schemas;
  9 schemas). Money integrity, idempotency (`ON CONFLICT (idempotency_key) DO
  NOTHING`, `payment.repository.ts:52-56`), and the CAS-guarded
  `compliance.transaction_events` trail all depend on this single DB.
- **There is NO backup or restore mechanism in the repo.** Nothing dumps,
  archives, or restores the database. A destroyed DB container is permanent
  data loss. → **#1 blocker: build backups + prove restore**
  (`docs/operations/backups.md`).
- Schema truth lives only in git: `master_init.sql` + `backend/migrations/*`
  (001, 002). Data is unrecoverable; schema is recoverable by re-applying SQL
  (hand-run; no migration runner exists — `runbook.md §12`).

---

## Failure matrix

### 1. Database unavailable

| Field | Content |
|---|---|
| OBSERVABLE | 500 `INTERNAL_SERVER_ERROR` on most business routes; boot log `[DB] PostgreSQL connection failed:` |
| SYSTEM BEHAVIOR | Boot only WARNS (`index.ts:194-197`); server keeps accepting `/health` (returns 200). No circuit breaker; every query waits `connectionTimeoutMillis: 5000` (`db/client.ts:22`) then errors |
| RISK | Auth/payment/billing/all state unavailable; Redis-metadata and Kafka still run; audit/ledger writes error at the DB layer |
| RTO | ESTIMATE 30–60 min (restart DB + restart backend per `runbook.md §2`; no failover) |
| RPO | **UNKNOWN → effectively ∞ on destruction**: no backups; survival of data equals survival of the container volume (`docker-compose.yml` `postgres_data` volume) |
| MITIGATION PRESENT | Soft-degrade startup; pool config with bounded timeouts; idempotent payment creates reduce duplicate-risk after recovery (`payment.repository.ts:40-56`) |
| GAP | Backups + restore; DB health in `/health` (currently `/health` never probes DB); replica/failover for a host-level loss |

### 2. Redis unavailable

| Field | Content |
|---|---|
| OBSERVABLE | Log noise `[Redis] Connection error (degraded mode):`; usage-quota enforcement silently stops |
| SYSTEM BEHAVIOR | Client gives up after 3 retries → `null` (`db/redis.ts:15-22`); `isRedisAvailable()` false; metering increments skipped (`metering/index.ts:27-30`); `checkSessionExhaustion()` returns `false` (sessions never auto-cut) (`metering/index.ts:39-43`) |
| RISK | Lost usage counters → underbilling that cannot be reconstructed; seller heartbeats/rate state in memory only. Server stays up |
| RTO | ESTIMATE 5–30 min (restart container + restart backend to re-init client) |
| RPO | ESPECIALLY N/A: by design Redis state is ephemeral; counters lost on outage are gone. A user who used data during the window may not be billed |
| MITIGATION PRESENT | Full degrade path coded; DB-backed delta billing (`billing/core/engines/byte-tracker.ts` — duplicate/reordered reports bill nothing) partially compensates on the DB side |
| GAP | Persist metering writes to DB (or accept under-count as a business decision); alert on `redis` degraded (see monitoring doc) |

### 3. Backend unavailable

| Field | Content |
|---|---|
| OBSERVABLE | `/health` non-200; app `Cannot reach the server.` |
| SYSTEM BEHAVIOR | Process exit on boot config error (`JWT_SECRET`, `env.ts` fail-fast); graceful SIGINT/SIGTERM close (`index.ts:215-223`). No process supervisor inside the repo's control |
| RISK | Total loss of API; Socket.IO push stops; nothing auto-recovers without a platform restart policy |
| RTO | ESTIMATE 15–30 min (redeploy/restart; platform auto-restart policies are ON_FAILURE with 10 retries in `railway.json:12-13`) |
| RPO | 0 for persisted data, by construction (state is in Postgres, not the process) — but audit events not yet in Kafka are dropped |
| MITIGATION PRESENT | Docker HEALTHCHECK pings `/health` with retries (`backend/Dockerfile:22-23`); graceful shutdown; fail-fast config guards |
| GAP | Monitored restart + alert if container flaps (no supervision alert exists); runbook step verifies only `/health`, which stays 200 during DB-degrade — cannot detect partial outage |

### 4. Relay / ISP unavailable

| Field | Content |
|---|---|
| OBSERVABLE | Empty package list; `Activation failed: <err>` on activate |
| SYSTEM BEHAVIOR | Axios timeouts (10/15/10 s) and degrade-to-`[]`/`{success:false}` (`isp/index.ts:54-62,79-81`). No retry beyond the single request; no cross-ISP failover |
| RISK | Marketplace and sessions degrade; revenue = usage-based so no usage → no billing |
| RTO | ESTIMATE 30–120 min (dependent on the upstream provider; DRAVIO can only wait + communicate) |
| RPO | N/A (no ISP state is durable in DRAVIO; activation reference may need replay) |
| MITIGATION PRESENT | Graceful adapter failure; `reference` parameter for activation idempotency (`isp/index.ts:69`) |
| GAP | Retry/backoff, provider status page link in runbook, per-ISP alert, second ISP fallback |

### 5. Payment provider unavailable (sandbox reality)

| Field | Content |
|---|---|
| OBSERVABLE | STK push errors; Stripe webhooks 400 or silent; top-ups stuck `PENDING` |
| SYSTEM BEHAVIOR | Stripe requires `STRIPE_SECRET_KEY` else `payment processing unavailable` (`stripe.provider.ts:14-17`); M-Pesa sandbox default (`mpesa.provider.ts:3-6`); webhook signature failures logged (`payment/index.ts:46`); all replay-safe via PENDING-guard |
| RISK | **Contained**: no real money moves. Payouts remain rows-only (`wallet.routes.ts:70-95`); `createPayout` never called (`stripe.provider.ts:60-67`). Wallet top-up stalls are the only durable pain |
| RTO | ESTIMATE 30–120 min (provider-downtime bound; status page + manual retry) |
| RPO | N/A: provider-agnostic DR; `PENDING` transactions survive in DB and can complete after recovery; idempotency prevents double-credit |
| MITIGATION PRESENT | Signature verification (Stripe constructEvent; M-Pesa amount reconciliation `payment/index.ts:64-79`); CAS transaction machine; fee computation integer-cents (`money.ts`) |
| GAP | Provider health probes; alert on webhook signature failures; documented manual reconciliation path (currently none exists for a stuck PENDING) |

### 6. DNS issue

| Field | Content |
|---|---|
| OBSERVABLE | Name-resolution failures for API/UI hostnames; in-app `Cannot reach the server.` |
| SYSTEM BEHAVIOR | Nothing in-code resolves names; failure is purely at DNS/provider layer. App uses fixed API base URL (`EXPO_PUBLIC_API_URL`), no IP fallback |
| RISK | Entire platform unreachable for the TTL/propagation window |
| RTO | ESTIMATE TTL-bound; operator action is editing records → 15–60 min |
| RPO | N/A |
| MITIGATION PRESENT | None in repo (platform-managed domains only) |
| GAP | Document authoritative records (platform console); external DNS status monitoring; public IP fallback is explicitly NOT recommended — document instead |

### 7. Certificate expiration

| Field | Content |
|---|---|
| OBSERVABLE | TLS handshake failure; clients see cert error; nothing can reach the platform |
| SYSTEM BEHAVIOR | Backend serves HTTP (`index.ts` plain listen); TLS terminates at platform/reverse proxy — no cert code in repo |
| RISK | Complete inbound outage until renewal |
| RTO | ESTIMATE 15–60 min to renew at issuer/platform |
| RPO | N/A |
| MITIGATION PRESENT | None in repo (platform auto-renew assumed, not verifiable) |
| GAP | Cert-expiry alert (see monitoring doc); verify auto-renew configuration at the platform provider |

### 8. Cloud instance failure (host / container host loss)

| Field | Content |
|---|---|
| OBSERVABLE | Instance down (SSH/dashboard lost); platform restarts or won't; Data volume upon that host |
| SYSTEM BEHAVIOR | Container/DB/Redis live on the same host in the current local compose (`docker-compose.yml`); Render free plan has no persistent disk SLA guarantee stated in-repo |
| RISK | Loss of DB volume = permanent data loss (**no backups**) — the worst case. Redis loss tolerable (ephemeral) |
| RTO | ESTIMATE 2–8 h for full rebuild if volumes survive; **unbounded if volume is lost** (would require backup restore that does not exist) |
| RPO | **∞ / total data loss** absent backups (DB volume; `mongodb_data` also present but Mongo is not in the backend's dependency graph by construction) |
| MITIGATION PRESENT | `restart: always` on DB/Redis containers; migrations idempotent so rebuild-from-git gives a working empty schema |
| GAP | **Backups + object-storage off-host storage; redeploy automation; documented rebuild-from-git runbook** (see backups doc) |

---

## Shared P0 blockers (need build, not code)

1. **Backup & restore** — nothing exists; restore is the #1 blocker
   (`docs/operations/backups.md`).
2. **Live prove-out of Postgres/Redis** — pending WSL2/VM reboot
   (`DB_WSL_DOCKER_SETUP.md`); every DB/Redis status in this matrix is
   VERIFIED-BY-CONSTRUCTION until then.
3. **Health that reflects dependencies** — `/health` returns 200 while the DB
   is down; a real readiness endpoint that probes `SELECT 1` + Redis `PING`
   must be built.
4. **Alerting on the failure signatures above** — all of them are detectable
   from logs today; nothing watches them
   (`docs/operations/monitoring-alerts.md`).
5. **Migration runner + CI reproducibility** — no versioned runner; CI `npm ci`
   blocked by untracked `package-lock.json` (`software-supply-chain.md §4`).

## Verified-by-construction citations used above

| Claim | Location |
|---|---|
| Soft-degrade startup for DB | `backend/src/index.ts:194-197` |
| Redis degrade everywhere | `backend/src/db/redis.ts:15-22`, `index.ts:199-204` |
| Health STAYS UP under DB failure | `index.ts:105-117` (no DB probe) |
| Payment idempotency | `payment/repositories/payment.repository.ts:40-56,92` |
| Webhook signature verification | `payment/index.ts:36-48`, `isp/index.ts:141-157` |
| CAS transaction machine | `payment/core/transaction-machine.ts:50-85` |
| Payouts rows-only | `billing/api/routes/wallet.routes.ts:61-95`; `stripe.provider.ts:60-67` never invoked by routes |
| M-Pesa sandbox default | `payment/providers/mpesa.provider.ts:3-6` |
| Schemas in one DB | `master_init.sql:3-9` |
| No telemetry ingestion anywhere | grep `otel|grafana|datadog|sentry|prometheus` over `backend/src` → zero hits (env placeholders only in `render.yaml:83-86`) |