# DRAVIO Monitoring & Alerting

Status: **NOT VERIFIED — no monitoring/alerting stack exists.**

What exists today (verified in code):
- **Fastify logger** — `level: 'info'` in production (`backend/src/index.ts:38`);
  log lines like `[DB] PostgreSQL connection OK` (`db/client.ts:34`),
  `[Redis] Connection error (degraded mode):` (`db/redis.ts:26`),
  `[Kafka] Skipping event ...` (`events/kafka.ts:43`), auth events, Stripe
  webhook failures (`payment/index.ts:46`).
- **Health endpoints `GET /` and `GET /health`** (`index.ts:105-117`) — the
  Docker `HEALTHCHECK` polls `/health` (`backend/Dockerfile:22-23`); Render and
  Railway both use it as their healthCheckPath (`render.yaml:13`,
  `railway.json:10`). **`/health` does NOT probe DB/Redis/Kafka** — it always
  returns `ok` when the process is up.
- No Datadog / Grafana / Prometheus / Sentry / PagerDuty anywhere:
  `grep -r "otel|opentelemetry|grafana|datadog|sentry|prometheus|pager" backend/src`
  → zero hits. (`render.yaml:83-86` defines `OTEL_EXPORTER_OTLP_ENDPOINT` +
  `OTEL_SERVICE_NAME` env keys but nothing consumes them.)

## Design constraints (honest)

- We are not fixing a software problem, we are fixing an absence. The cheapest
  verifiable approach is **cron/CI check scripts that hit the health endpoint
  and parse the process log**, then notify by webhook/email. No inventory stack
  is warranted until the DB/Redis live prove-out (WSL2 reboot pending,
  `DB_WSL_DOCKER_SETUP.md`) has happened.
- Every alert below is **achievable today with the documented commands** against
  the local process and container logs; the only build piece is the scheduler +
  notifier.

## Metric sources (health probes today — what they can and cannot tell you)

| Probe | Command (real) | Tells you | Does NOT tell you |
|---|---|---|---|
| Process alive | `curl -s -o NUL -w "%{http_code}" http://127.0.0.1:8080/health` | Backend responds | DB/Redis/Kafka state |
| DB alive | `docker exec -i dravio-db pg_isready -U dravio_user -d dravio_production` | Postgres up | data integrity, WAL lag |
| DB round-trip | `docker exec -i dravio-db psql -U dravio_user -d dravio_production -c "SELECT 1"` | Query path | — |
| Redis alive | `docker exec dravio-redis redis-cli ping` | Redis up (expect `PONG`) | key count/size |
| Kafka alive | (compose only) `docker exec dravio-kafka cub kafka-ready -b kafka:9092 1 1` | Broker reachable | topic health |
| TLS expiry | `echo | openssl s_client -connect <fqdn>:443 -servername <fqdn> 2>/dev/null | openssl x509 -noout -enddate` | Cert notAfter | auto-renew action |

## Alert triggers (build list — each with a real detection command and a cited code path)

### 1. Repeated auth failures (credential-stuffing / takeover signal)
- Detect: `docker logs <backend-container> --tail 1000 | findstr /c:"auth.login.failure"` — emitted on every `INVALID_CREDENTIALS` (`auth/index.ts:96-104`); login is already rate-limited 5/min (`auth/index.ts:69-71`) so a burst is notable.
- Alert: ≥ 10 `auth.login.failure` per 10 min for the same email/actor.

### 2. Payment failures / stuck PENDING
- Detect: `curl -s http://127.0.0.1:8080/v1/payments/<id>/status`; or log grep
  `findstr /i "STK Push failed PROCESSING_FAILED"`.
- Sources: M-Pesa `STK Push failed: ...` (`mpesa.provider.ts:104-106`);
  `PROCESSING_FAILED` (`payment/index.ts:59,78`); >3 failed payments per user is
  the fraud engine's `MULTIPLE_FAILED_PAYMENTS` rule (`fraud/index.ts:12-22`).

### 3. Webhook signature failures (tampering / misconfiguration)
- Detect: log grep `findstr /c:"Signature verification failed" /c:"INVALID_SIGNATURE" /c:"MISSING_SIGNATURE"`.
- Sources: Stripe `[Stripe webhook] Signature verification failed:` (`payment/index.ts:46`); ISP HMAC `MISSING_SIGNATURE` 401 / `INVALID_SIGNATURE` 403 via `timingSafeEqual` (`isp/index.ts:141-157`).
- Note the ISP fallback secret foot-gun: `process.env[ISP_<ID>_SECRET] || 'default_secret'` (`isp/index.ts:144`) — a missing secret silently uses a default key. Alert on any 401/403 spike; then fix the secret.

### 4. Duplicate payload keys (replay / retry storms)
- Detect: log grep `findstr /c:"replay" /c:"idempotency_key" /c:"ignored"` plus count of `received:true` webhook acknowledgements.
- Sources: idempotency path is safe by construction — `ON CONFLICT (idempotency_key) DO NOTHING` (`payment.repository.ts:52-56`), replay-safe PENDING guard (`payment.repository.ts:92`), delta-based billing (`billing/core/engines/byte-tracker.ts:13-16`), webhook `{received:true,status:'ignored'}` for replays (`payment/index.ts:52-56`). A sustained replay rate is a signal of a mis-configured provider retry, not an incident **yet**.

### 5. DB connection failure
- Detect: boot + runtime: log `[DB] PostgreSQL connection failed:` (`db/client.ts:37`), `[DB] PostgreSQL connection OK` (`db/client.ts:34`); health rarely suffices. Alert if the container is polling 0 (`pg_isready` exit != 0 for 2 consecutive checks). **Since `/health` stays 200 with a dead DB, this alert is mandatory before any trust in the platform.**

### 6. Redis failure
- Detect: log `[Redis] Connection error (degraded mode):` / `operating without Redis` (`db/redis.ts:17,26,35,45`); `redis-cli ping` not `PONG`. Impact: metering counters lost, quota enforcement off (`metering/index.ts:39-43`).

### 7. High error-rate (generic 5xx/502)
- Detect: `curl -s -o NUL -w "%{http_code}" http://127.0.0.1:8080/health` (only gives process-level); for real error rate you must count business-route 5xx in the log: `findstr /c:"INTERNAL_SERVER_ERROR" /c:"502"`. Note `BAD_GATEWAY` 502 is emitted for upstream ECONNREFUSED/reset (`index.ts:89-96`). **With only Fastify logs there is no metrics counter — this alert is a log-grep rate counter, not a percentile dashboard.** A real metrics export (prom-client / OTLP) must be built; the env keys in `render.yaml:83-86` are placeholders.

### 8. Certificate expiry
- Detect: `openssl s_client ... | openssl x509 -noout -enddate` on each public FQDN (list is NOT verifiable from the repo — populate from the platform console: CORS origins in `render.yaml:33` are a partial hint). Alert ≥ 14 days before `notAfter`. TLS is platform-terminated; DRAVIO code has no cert handling.

### 9. Audit pipeline degraded (Kafka absent) — the least obvious, most compliance-relevant
- Detect: `findstr /c:"async audit event" /c:"event publishing disabled" /c:"audit logging disabled"` (`events/kafka.ts:25,43`, `audit/index.ts:7`). The audit trail silently degrades; `compliance.transaction_events` (same-DB-transaction) still records transitions, so the CAS trail survives; the Kafka `audit.audit_log` copy does not.

## How to wire alerts WITHOUT inventing a stack (buildable today)

1. **Scheduler:** host `cron` (WSL/Linux) or Windows Task Scheduler running a
   PowerShell/Script check every 5 minutes. No new runtime.
2. **Checker script (example shape, uses the commands above):**
   ```powershell
   $h = curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:8080/health
   if ($h -ne "200") { Send-MailMessage -To ops@ -From alarm@ -Subject "DRAVIO /health $h" ... }
   docker exec dravio-db pg_isready -U dravio_user -d dravio_production 2>$null
   if ($LASTEXITCODE -ne 0) { <notify> }
   ```
   Same pattern for `redis-cli ping` and the log greps.
3. **Notifier:** email (SMTP `Send-MailMessage`) or a plain webhook (Discord/Slack
   incoming webhook) as the only dependency. This keeps the alerting surface
   inside the repo's own scripts folder (`scripts/`) — no SaaS agent.
4. **Centralize state, not magic:** each script writes a timestamped result file;
   a second pass can compute "repeated auth failures in 10 min" from the log
   tail. This is deliberately boring and auditable.

## Noise-control guidance

- **Include the evidence in the alert body** — always attach the exact log line
  or numeric result; an alert without evidence gets ignored.
- **Degraded ≠ down:** Redis/Kafka messages are *degraded-mode warnings by
  design*; alert only on the **first** occurrence per interval, then deduplicate.
- **Rate-limit alerts per subject:** group by email / payment / webhook so a
  credential-stuffing burst produces one alert, not 400.
- **Shadow-mode first:** for 60 days send alerts to a dedicated mailbox and
  measure the false-positive rate before on-call is introduced.
- **Do not alert on `/health` failures before DB/Redis alerts** — the 200-while-degraded
  flaw means a `/health` alert always lags the real cause; fix readiness (build
  a `/health` that probes dependencies) rather than multiplying checks.
- **Add `local7`/file log sizing:** Fastify writes to stdout; in containers this
  rolls with the platform. If you ship container logs off-host, add retention
  (see `backups.md`) — operator log retention is not compliance evidence.

## What remains a genuine build (not a check-script)

- Readiness health endpoint (DB `SELECT 1` + Redis `PING` inside `/health`) —
  required before `/health` is trustworthy.
- Structured metrics export (prom-client counters for 5xx, auth failures,
  webhook failures) — today everything is log-grep, which is lossy.
- Log shipping to a durable store for the audit/compliance story
  (FINAL_COMPLIANCE_REPORT.md: audit trail durability "depends on Kafka
  availability").

Verification rule for each alert added: fire it deliberately (stop the DB
container, kill the backend, send a bad webhook signature) and confirm the
webhook/email fires *once, with evidence*, then recovers — that is the entire
acceptance criteria for this doc.