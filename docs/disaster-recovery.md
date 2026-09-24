# DRAVIO Disaster Recovery & Operability Guide

## Failure modes

| Failure | Detection | Recovery | RPO | RTO |
|---|---|---|---|---|
| Postgres outage | `/health` down; connection pool errors | Failover to replica; restore from PITR backup | 5 min (PITR) | <30 min |
| Redis outage | billing/session degraded warnings | Re-seed from `billing.sessions` + marketplace heartbeats regenerate listing TTLs | 0 (stateless) | instant (sessions capped) |
| Kafka outage | `KAFKA_URL` unavailable logs | Consumers degrade gracefully; events lost (audit best-effort) | n/a (non-blocking) | n/a |
| Stripe outage | provider timeouts on initiate | HTTP 500/503 to clients; retry on Stripe side | 0 (Stripe) | n/a |
| M-Pesa outage | STK push failures logged | Failed transactions stay PENDING/FAILED; no wallet credit until verified | 0 | n/a |
| Secret rotation | login/refresh failures | Rotate `JWT_SECRET` (invalidates sessions); rotate provider keys | instant | instant |

## Money-movement guarantees

- A wallet credit happens **inside** the same DB transaction that completes a
  payment or bills a session. Either both happen or neither.
- The committed-byte counter in Redis only advances after the money transaction
  commits, so a mid-flight crash cannot double-bill: replay reports compute a
  zero delta.
- Reconciling: `SELECT sum(amount_usd) FROM payments.transactions WHERE
  status='COMPLETED'` must equal `SELECT sum(amount_usd) FROM
  billing.ledger_entries WHERE status='COMPLETED'` (plus fee split recorded per
  transaction).

## Backup strategy (recommended)

1. **Postgres**: weekly full + daily WAL/PITR (enable automated backups on
   Railway; restore drill quarterly).
2. **Redis**: no persistent data of consequence (sessions, listings, rate state) —
   it rebuilds naturally. Do not rely on it for money records (see ledger).
3. **Provider state**: Stripe/M-Pesa hold the source of truth for charges; keep
   `provider_ref` on transactions to reconcile.
4. **Source / config**: git is the source; `.env` values live in the platform.

## Restore runbook — postgres

1. `railway up` / restore tool -> point `DATABASE_URL` at restored instance.
2. Run `backend/migrations/001_hardening.sql` (idempotent).
3. Boot backend; verify `/health` + DB `testConnection`.
4. Reconcile ledger (section above) and open a support ticket for any mismatch
   before re-enabling payments.

## Operational hygiene

- Enable structured request logging + metrics endpoint (currently `/health`).
- Ship logs to a SIEM/aggregator (Grafana Cloud / Railway Logs).
- Restrict DB/Redis/Kafka to private networks (no public egress).
- Weekly secrets scan: `git grep -IE "sk_live_|AKIA[0-9A-Z]{16}|BEGIN.*PRIVATE KEY"`.
- Quarterly restore drill + pen-test bores (see `security-checklist.md`).