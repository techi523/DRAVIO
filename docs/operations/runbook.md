# DRAVIO Operations Runbook

Owner: platform engineering.
Companions: `docs/operations/disaster-recovery.md`, `docs/operations/backups.md`,
`docs/operations/monitoring-alerts.md`.
Grounded in: `backend/src/index.ts` (startup/health/shutdown), `backend/src/db/*`,
`backend/src/modules/{audit,payment,isp,compliance,billing,fraud,auth}/*`,
`backend/migrations/*`, `master_init.sql`, `render.yaml`, `railway.json`,
`docker-compose.yml`, `backend/Dockerfile`,
`docs/testing/DB_WSL_DOCKER_SETUP.md`, `docs/compliance/FINAL_COMPLIANCE_REPORT.md`.

## Status vocabulary

- **VERIFIED-LIVE** — exercised against a running system in this environment.
- **VERIFIED-BY-CONSTRUCTION** — confirmed by reading code (route exists, handler
  degrades, error code documented). Not live-exercised.
- **NOT VERIFIED-LIVE** — behaviour is coded but the connected runtime has not
  been proven (PostgreSQL/Redis have not yet been run: WSL2/VM reboot pending —
  see `docs/testing/DB_WSL_DOCKER_SETUP.md`).
- **UNTESTED** — expected behaviour with no code evidence and no live run.
- **PARTIAL** — some steps are real/coded, others are not.
- **BLOCKED / NOT APPLICABLE** — used where noted.

Reality constraints that apply to every procedure below:

- **PostgreSQL + Redis are NOT proven running locally.** Docker Desktop on this
  host cannot start the Linux engine until the machine is rebooted
  (`DB_WSL_DOCKER_SETUP.md`). All DB-connected behaviour is therefore
  **VERIFIED-IN-CODE / NOT VERIFIED-LIVE**.
- **Kafka is optional.** Every produce/consume path logs a warning and degrades
  (`backend/src/events/kafka.ts`, `backend/src/modules/audit/*`). Audit events
  are dropped (non-fatally) when Kafka is absent.
- **There is NO real money movement.** Payouts are rows-only — `POST
  /v1/billing/withdraw` writes `payments.payouts` status `PENDING` and tells the
  user no funds were transferred (`billing/api/routes/wallet.routes.ts:61-95`).
  M-Pesa runs against the sandbox (`MPESA_ENV=sandbox` default,
  `providers/mpesa.provider.ts:3-6`). Stripe is contract-dependent; no live keys
  exist in the repo.
- **NO backup/restore infrastructure exists.** `docs/operations/backups.md`.

Health endpoints confirmed in code: `/` and `/health`
(`backend/src/index.ts:105-117`); the Docker `HEALTHCHECK` pings `/health`
(`backend/Dockerfile:22-23`). The testing doc mentions `curl /v1/health`
returning 200 from an earlier probe session, but **no `/v1/health` route exists
in the current backend source** — treat that reference as a discrepancy; use
`/health` for probes.

---

## 1. Application outage (backend down / not responding)

**Status: VERIFIED-BY-CONSTRUCTION (startup fail-fast, `/health`, graceful
shutdown); platform restart path UNTESTED.**

Why: `JWT_SECRET` is enforced at boot (`index.ts:55-57`, `config/env.ts:6`
min 32 chars), the server advertises `/health`, listens on `0.0.0.0`
(`index.ts:190-191`), and SIGINT/SIGTERM trigger a graceful close
(`index.ts:215-223`). No live deployment was exercised in this session.

SYMPTOMS — mobile app shows `INTERNAL_SERVER_ERROR` / `Cannot reach the
server.`; buyer-web/admin calls fail; health probes return non-200.

DETECT —
- Global rate limit is 200 req/min (`index.ts:73-76`); a 429 storm on `/health`
  can look like an outage — check first.

CONFIRM —
```
curl -s -o NUL -w "%{http_code}" http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/          # expects {status:"ok",service:"dravio-backend",version:"2.0.0"}
docker ps                               # is the container up?
```
If the process is a local `tsx src/index.ts` run, check the terminal log for
`FATAL: JWT_SECRET environment variable is required` (`index.ts:55-57`) or the
`DRAVIO Backend ready` line (`index.ts:212`).

ACT —
1. Confirm health payload: `{"status":"ok","service":"dravio-backend","uptime":...}`.
2. Read the log: `docker logs dravio-backend --tail 200` (or the platform logs
   on Render/Railway). Look for `Fatal`/`FST_*`/unhandled errors.
3. Restart: platform redeploy, or locally re-run
   ```
   cd backend
   $env:JWT_SECRET='<48 chars>'; $env:DATABASE_URL='postgres://...'; $env:REDIS_URL='redis://...'; $env:NODE_ENV='production'
   tsx src/index.ts
   ```
4. Because dependencies degrade softly, a booted server with a bad DB is still
   "healthy" at `/health` — see §2 before declaring the incident closed.

VERIFY — `/health` returns 200; a real authenticated call (e.g.
`POST /v1/auth/login`) behaves normally or shows the expected degraded state.

---

## 2. Database outage (PostgreSQL)

**Status: PARTIAL — boot-time degrade VERIFIED-BY-CONSTRUCTION; per-route
behaviour NOT VERIFIED-LIVE (no running DB has been proven on this host).
Restore handling: BLOCKED — no backups exist.**

Why: at startup the server only warns `Database connection failed - some
features may be degraded` (`index.ts:194-197`). `pool` has
`connectionTimeoutMillis: 5000`, `max: 10`, and only logs idle-client errors
(`db/client.ts:9-27`). What individual routes do mid-request with a dead DB is
**NOT VERIFIED-LIVE**.

SYMPTOMS — log line `[DB] PostgreSQL connection failed:`; auth/payment/billing
routes returning 500 `INTERNAL_SERVER_ERROR`; server process still up.
Health endpoints remain 200 (they do not query the DB).

CONFIRM —
```
docker exec -i dravio-db psql -U dravio_user -d dravio_production -c "SELECT 1"
docker logs dravio-db --tail 50
docker ps -a --filter name=dravio-db
```
(Container name `dravio-db` per `DB_WSL_DOCKER_SETUP.md`. `docker-compose.yml`
names it `dravio-postgres` — match container name to what is actually deployed.)

ACT —
1. The app will NOT heal itself if the DB comes back while a connection pool
   is wedged — restart the backend after the DB recovers.
2. Restart the DB container first:
   ```
   docker restart dravio-db
   docker exec -i dravio-db pg_isready -U dravio_user -d dravio_production
   ```
3. Then restart the backend (see §1).
4. Record the window. There are no backups → any DB container data loss is
   permanent (**BLOCKED**, see `docs/operations/backups.md`).

VERIFY — `[DB] PostgreSQL connection OK` at boot; a live INSERT/UPDATE
workflow (register → pay) succeeds.

---

## 3. Redis outage

**Status: PARTIAL — degrade VERIFIED-BY-CONSTRUCTION; data-loss impact is a
documented GAP (not a fix).**

Why: `getRedis()` returns `null` after 3 retries / no `REDIS_URL` and logs
`operating without Redis` (`db/redis.ts:5-50`, `index.ts:199-204`). Sessions,
seller heartbeats, rate state, metering counters, and the seller marketplace
listing are Redis-backed (`security-architecture.md` trust-boundary diagram;
`modules/metering/index.ts:27-30`). When Redis is down,
`checkSessionExhaustion()` returns `false` (`metering/index.ts:39-43`) —
sessions are not cut off and **usage counters are lost**.

SYMPTOMS — `[Redis] Connection error (degraded mode):` (repeat log); wallet
balances still fine; usage billing / session quota behaviour silently weakens.

CONFIRM —
```
docker exec dravio-redis redis-cli ping      # expect PONG when up
docker ps -a --filter name=dravio-redis
```

ACT —
1. `docker restart dravio-redis`; verify `redis-cli ping` → `PONG`.
2. Restart the backend so `getRedis()` re-initialises the client
   (`redis.ts` caches a non-null client only on first call).
3. Accept/reconcile: any `session:<id>:usage` counters lost during the outage
   are gone; quota enforcement resumes only for new increments.

VERIFY — boot log shows `Redis client initialized`; `PONG` from the container.

---

## 4. Payment provider outage (sandbox reality)

**Status: PARTIAL — signature verification and state-guards VERIFIED-BY-
CONSTRUCTION; no live provider run in this environment.**

M-Pesa is sandbox by default (`MPESA_ENV` default `sandbox`,
`mpesa.provider.ts:3-6`); Stripe depends on contract/keys (`STRIPE_SECRET_KEY`
absent → `payment processing unavailable`, `stripe.provider.ts:14-17`). No
provider credentials exist in the repo, so a live provider failure cannot be
reproduced here.

SYMPTOMS — top-ups stall: `initiatePayment` fails or stays `PENDING`; M-Pesa
STK push errors like `M-Pesa STK Push failed: ...`
(`mpesa.provider.ts:104-106`); Stripe webhooks returning 400.

DETECT / CONFIRM —
```
curl -s -X POST http://127.0.0.1:8080/v1/payments/initiate -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d "{\"amount_usd\":5}"
docker logs <backend-container> --tail 100 | findstr /i "stripe mpesa provider"
```
Webhook signature failures are observable in logs:
- Stripe: `[Stripe webhook] Signature verification failed:` (`payment/index.ts:46`)
- ISP webhook: `MISSING_SIGNATURE` (401) / `INVALID_SIGNATURE` (403) with
  `timingSafeEqual` (`isp/index.ts:147-157`).

ACT —
1. Verify provider status outside DRAVIO (Safaricom / Stripe status pages) —
   do not assume it is DRAVIO's fault.
2. Keep the app up. In-flight `PENDING` transactions remain; the exact
   idempotency replay guard prevents double-processing on retry
   (`payment.repository.ts:52-56` `ON CONFLICT (idempotency_key) DO NOTHING`,
   `WHERE status='PENDING'` at line 92).
3. **Do not "settle" failed top-ups manually.** Money-affecting transitions
   (REFUND/PARTIALLY_REFUNDED/REVERSED) are BILLING_ADMIN-gated
   (`transaction-machine.ts:50-85`).
4. Record that any guaranteed settlement is BLOCKED: withdrawal writes a
   `PENDING` `payments.payouts` row only (`wallet.routes.ts:70-95`), and
   `stripeProvider.createPayout` (`stripe.provider.ts:60-67`) is never called
   by any route today (verified by search).

VERIFY — new sandbox top-up completes; webhook returns 200 with
`{received:true}`; provider dashboard shows the sandbox intent/callback.

---

## 5. Relay / ISP outage

**Status: PARTIAL — failure handling VERIFIED-BY-CONSTRUCTION; live exercise
UNTESTED (no real ISP credentials in repo).**

Why: `ProductionAdapter` uses axios timeouts (10 s list-packages, 15 s
activate, 10 s usage) and degrades instead of throwing: `listPackages` returns
`[]` (`isp/index.ts:54-62`), `activateData` returns `{success:false}` on error
(`isp/index.ts:79-81`). Config is dynamic: `ISP_<ID>_BASE_URL` /
`ISP_<ID>_API_KEY` / `ISP_<ID>_SECRET` (`isp/index.ts:106-115`).

SYMPTOMS — marketplace shows empty packages; activation fails with
`Activation failed: ...`; usage reports 0.

CONFIRM —
```
curl -s http://127.0.0.1:8080/v1/isp/001/packages            # empty list {"packages":[]}
curl -s http://127.0.0.1:8080/v1/isp/001/usage/<activationId>
```

ACT —
1. Confirm outbound to the ISP is the problem: `Test-NetConnection api.upstream-isp.com -Port 443` (replace with the real `ISP_001_BASE_URL`).
2. If a package or activation is confirmed stuck, do not re-activate blindly —
   activation is externally idempotent only to the extent the provider
   supports `reference` (`isp/index.ts:69`).
3. Inform affected sessions; there is no automated failover between ISPs.

VERIFY — package list non-empty again; an activation POST returns
`{"success":true, "activation_id":...}`.

---

## 6. Security incident (generic)

**Status: PARTIAL — logging/audit paths exist (VERIFIED-BY-CONSTRUCTION);
no SIEM, no on-call, no alerting (NOT VERIFIED / build needed).**

Whats already true in code: Fastify logs at `info` in production
(`index.ts:38`); audit events are emitted with field redaction
(`audit/producer.ts:21-34`, `compliance/pure/audit-events.ts`); auth failures
emit `auth.login.failure` (`auth/index.ts:96-104`).

ACT (runbook skeleton — keep an incident log with timestamps):
1. Freeze: note the time; capture the log tail
   (`docker logs <container> --tail 500`).
2. Determine blast radius: which users/roles/tokens are involved; check
   `compliance.transaction_events` (audit per-transition rows) and
   `audit.audit_log` for the affected actor.
3. If credentials are suspected leaked: revoke refresh tokens
   (`auth.repository.ts` — logout revokes all a user's tokens;
   `security-architecture.md`), rotate `JWT_SECRET` (forces re-login; restart
   backend — it reads the secret from env).
4. Stand up manual monitoring because none exists (see
   `docs/operations/monitoring-alerts.md`).
5. Escalate per legal guardrails — breach-notification rules are **LEGAL
   REVIEW REQUIRED** (FINAL_COMPLIANCE_REPORT §2 #9). Do not assert a number.

---

## 7. Account takeover

**Status: PARTIAL — detection surfaces VERIFIED-BY-CONSTRUCTION; response
process is manual. No SIEM/watchlist exists (NOT VERIFIED).**

Coded mitigations (already true): access tokens 15-min TTL, refresh tokens
stored hashed (sha-256) with 30-day expiry and revocation
(`security-architecture.md`; `auth/index.ts:11-27`); login rate-limited to
5/min (`auth/index.ts:69-71`); `auth.login.failure` audit events
(`auth/index.ts:96-104`); ownership scoping on payments/session/profile routes.

SIGNALS TO LOOK FOR (manual, via log grep):
```
docker logs <container> --tail 5000 | findstr /c:"auth.login.failure"
docker logs <container> --tail 5000 | findstr /c:"429" /c:"rate limit"
```

ACT — verify the reported actions with the user (out-of-band); force logout
all devices for the user; rotate credentials; if money is involved, freeze via
BILLING_ADMIN (do **not** unilaterally reverse — see
`transaction-machine.ts:50-85` role gates). Record the case for periodic
review; no watchlist feed exists (build).

---

## 8. Data breach

**Status: NOT VERIFIED / BLOCKED.** No backup of the DB; no SIEM; no log
shipping; breach-notification timeline requires counsel
(`FINAL_COMPLIANCE_REPORT.md` §2 #9 — "No number is assumed or asserted").
There is no data-loss history to recover from -> see backups doc first.

ACT —
1. Preserve evidence: stop writing; snapshot the running container's volume if
   possible (`docker commit` is not a backup — record this limitation).
2. Identify which schema(s) are affected. PII lives in `users.*`,
   `auth.refresh_tokens` (hashed), device UUIDs, `sessions.*`,
   `billing.seller_earnings`, `payments.*` (pseudonymous UUIDs retained after
   DSAR deletion — see `compliance/pure/privacy-rights.ts:122`).
3. Contain: revoke sessions, rotate secrets, gate routes.
4. Notify per counsel/ODPC guidance — do not fabricate a window.
5. Document in the post-incident report what **must be built**: log shipping,
   backups, alerting (companion docs).

---

## 9. Fraud response

**Status: PARTIAL — rule engine and admin endpoints VERIFIED-BY-CONSTRUCTION;
the Kafka consumer that should react to events is a stub (logs only).**

Coded: `MULTIPLE_FAILED_PAYMENTS` (risk 0.9) when `failed_count > 3`,
`IMPOSSIBLE_TRAVEL` (risk 0.8) when country changes in <60 min
(`modules/fraud/index.ts:12-35`); admin-only analysis endpoints
(`fraud/index.ts:67-91`). The consumer subscribed to
`dm.payment.completed`/`dm.auth.user_registered` only logs
(`fraud/index.ts:46-61`) — **no automatic action is taken**.

ACT — treat `BLOCK`/`FLAG` from
`POST /v1/internal/analyze/payment` (ADMIN token required) as signal, not
enforcement. Manually: freeze the wallet route is not exposed — losing
transaction history is impossible while `billing.wallets` has a
non-negative CHECK and `payments.transactions` is immutably appending
(`001_hardening.sql:36-38`). Manually review `compliance.transaction_events`
for the actor and use BILLING_ADMIN transitions for reversals.

VERIFY — the fraud decision endpoint returns `{action:"BLOCK"|"ALLOW"}` for a
sample `failed_count`.

---

## 10. Failed deployment

**Status: UNTESTED (live) / PARTIAL-BY-CONSTRUCTION.** Render blueprint uses
`healthCheckPath: /health` (`render.yaml:13`); Railway uses
`healthcheckPath: /health` with 10 retries (`railway.json:10-13`). Two
deployment manifests diverge: Render runs the single `backend/Dockerfile`;
Railway runs `services/gateway-service/Dockerfile.render` + `start-all.sh`
(multi-service). Which is live is not provable from the repo.

SYMPTOMS — new deploy repeatedly failing health check; bad rollout serving
errors; version route `/` reporting unexpected `version`.

DETECT —
```
curl -s http://<host>:8080/                       # {"service":"dravio-backend","version":"2.0.0"}
docker images --filter "dangling=true"
```

ACT — confirm the failing artifact (build logs); check `npm ci` FIRST — CI
currently cannot run `npm ci` at repo root because `package-lock.json` is
untracked (`software-supply-chain.md` §4) → that failure mode is real and
documented. Re-run the previous successful deploy if the failure was in the
new artifact.

---

## 11. Rollback

**Status: UNTESTED. No rollback automation exists.**
Mechanism today: re-deploy a previous commit / build (Platform: Render/Railway
manual re-deploy), or locally check out the last-known-good commit and rebuild.
There is no image registry retention policy in the repo, no feature flags, and
no canary. `npm ls --depth=0` in `backend/` is reported clean
(`software-supply-chain.md`), so the last-known-good is the last committed
backend tree.

ACT —
1. Revert the code: `git revert <sha>` or re-deploy previous platform deploy.
2. Re-run migrations only if the DB did not move (see §12).
3. If the "bad" deployment already ran an irreversible DB migration, you
   cannot roll back the schema — see §12/backups doc (BLOCKED on backup).

VERIFY — `/health` green; smoke auth + one payment-flow call; DB migrations
table/version consistent with expectation.

---

## 12. Failed DB migration

**Status: UNTESTED / NOT VERIFIED. There is NO migration runner.**
Migrations are hand-applied SQL files: `master_init.sql` (repo root) →
`backend/migrations/001_hardening.sql` → `backend/migrations/002_compliance.sql`
(all "idempotent", applied per `DB_WSL_DOCKER_SETUP.md` §4). No versioning
table, no release tooling — you cannot detect "the last applied migration"
automatically.

CONFIRM schema state —
```
docker exec -i dravio-db psql -U dravio_user -d dravio_production -c "\dt audit.*"
docker exec -i dravio-db psql -U dravio_user -d dravio_production -c "\dt compliance.*"
docker exec -i dravio-db psql -U dravio_user -d dravio_production -c "SELECT column_name FROM information_schema.columns WHERE table_schema='audit' AND table_name='audit_log';"
```

ACT — with no backup, the safe path for a failed DDL is **do the next
migration as a correction, not a destructive rollback**. All current migrations
use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS`
(`001`: lines 13, 32, 37; `002`: lines 8, 13, 16 ...) so re-running the latest
file is the documented recovery. If a migration partially applied, inspect the
schema against the file and apply the missing statements manually — then alert
the ops mailbox (this is exactly the gap backups/migrations tooling will close).

VERIFY — schema objects present once; business smoke test passes.

---

## 13. Certificate (TLS) expiry

**Status: NOT VERIFIED. No certificate automation exists in this repo.**
TLS is terminated at platform/Vercel-managed domains or reversing proxies;
DRAVIO backend itself serves HTTP only. There is no cert rotation, no expiry
monitor, and no CDN config in the repo.

DETECT (from an operator machine — real commands, point at the public FQDN
when they exist; today none are verifiable from the repo):
```
# Windows / OpenSSL:
openssl s_client -connect <fqdn>:443 -servername <fqdn> </NUL 2>NUL | openssl x509 -noout -enddate
# or
echo | openssl s_client -connect <fqdn>:443 -servername <fqdn> 2>/dev/null | openssl x509 -noout -dates
```

ACT — renew at the certificate issuer/platform; after renewal re-test the
above and confirm the new `notAfter`. **Build** an expiry alert (see
`monitoring-alerts.md`) instead of relying on manual checks.

---

## 14. DNS failure

**Status: UNTESTED (live DNS records are not verifiable from this repo).**

SYMPTOMS — `Cannot reach the server.` on mobile/web for multiple users in one
region while the backend host is up.

CONFIRM (real commands on the operator machine):
```
Resolve-DnsName buyer-web-henna.vercel.app
Resolve-DnsName admin-portal-weld-seven.vercel.app
nslookup <api-fqdn>
```
Compare against platform-provided CNAME/A records; confirm the dig answers
match the platform's published records. Do not invent the FQDN list — read
`render.yaml:33` (CORS origins) and the platform console.

ACT — fix records at the DNS provider / platform; purge public resolvers is
outside your control — allow propagation (TTL-dependent). While DNS is broken
the API is unreachable by name; nothing in the app falls back to an IP.

VERIFY — `Resolve-DnsName` resolves and `curl /health` over the FQDN returns
200.

---

## Status summary

| Procedure | Status |
|---|---|
| 1. Application outage | VERIFIED-BY-CONSTRUCTION (restart path UNTESTED) |
| 2. Database outage | PARTIAL (degrade BY-CONSTRUCTION; DB not live; restore BLOCKED) |
| 3. Redis outage | PARTIAL (degrade BY-CONSTRUCTION; live run pending WSL reboot) |
| 4. Payment provider outage | PARTIAL (signature logic BY-CONSTRUCTION; sandbox/contract only) |
| 5. Relay/ISP outage | PARTIAL (adapter degrade BY-CONSTRUCTION; no real ISP creds) |
| 6. Security incident | PARTIAL (logs/audit exist; no SIEM, no alerting) |
| 7. Account takeover | PARTIAL (rate limits + revocation coded; manual response) |
| 8. Data breach | NOT VERIFIED / BLOCKED (no backups, no SIEM, legal Q open) |
| 9. Fraud response | PARTIAL (rules coded; consumer is a stub) |
| 10. Failed deployment | UNTESTED (partially by-construction; CI `npm ci` blocked on lockfile) |
| 11. Rollback | UNTESTED (no automation) |
| 12. Failed DB migration | UNTESTED (no migration runner; manual idempotent SQL only) |
| 13. Cert expiry | NOT VERIFIED (no automation; platform-managed TLS) |
| 14. DNS failure | UNTESTED (records not provable from repo) |

**Actions that block a real ops posture (each is a build item):** backup/restore
(#1 blocker), migration runner, CI `npm ci` un-stick (commit
`package-lock.json`), alerting, log shipping/SIEM, and live prove-out of
Postgres/Redis after the WSL2 reboot documented in `DB_WSL_DOCKER_SETUP.md`.