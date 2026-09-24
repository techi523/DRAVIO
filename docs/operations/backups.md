# DRAVIO Backup & Restore

Status: **NOT VERIFIED — NO backup mechanism exists in this repository.**

Read this before anything else in this doc: there is no dump, no archive, no
scheduled job, no object-storage sync, and no restore procedure in the
codebase. The only source of truth for *schema* is git (`master_init.sql` +
`backend/migrations/001_hardening.sql` + `backend/migrations/002_compliance.sql`);
the only source of truth for *data* is the running PostgreSQL volume
(`docker-compose.yml` `postgres_data`), which is a single point of failure.

`docs/operations/disaster-recovery.md` ranks this as **blocker #1** ("a
destroyed DB container is permanent data loss").

---

## Current state (honest)

| Item | State |
|---|---|
| Scheduled dumps | NONE |
| WAL archiving | NONE |
| Point-in-time recovery | NONE |
| Restore procedure | NONE (untested) |
| Off-host storage | NONE |
| Schema source of truth | git (`master_init.sql`, `backend/migrations/001,002`) — `VERIFIED` (files committed) |
| Data source of truth | single Postgres volume — no redundancy |
| Does the app write to Redis that matters? | Redis is ephemeral caching/metering (`db/redis.ts`, `metering/index.ts`); by design not backed up |
| Kafka durable events | NOT durable; events dropped when Kafka absent (`events/kafka.ts`, `audit/producer.ts`) |

Consequence: `RPO = anything`; in practice **RPO = the entire dataset** if the
volume is lost. This is the #1 blocker standing between "demo" and
"operational service".

---

## Targets (ESTIMATEs — same methodology as disaster-recovery.md; no SLOs exist)

- **RPO target:** ≤ 24 h once daily dumps exist; ≤ 5 min when WAL archiving is
  added (these are planning targets, not commitments).
- **RTO target:** ≤ 1 h for a mid-week restore into a fresh container; ≤ 4 h
  for a full rebuild from git + verified restore. Re-baseline after the first
  successful drill.

---

## Minimal build plan (what to build, in order)

### 1. Daily logical dumps (fastest win)

- **Tool:** `pg_dump` (logical) — matches the single-node Postgres 15/16 in
  `docker-compose.yml` / `DB_WSL_DOCKER_SETUP.md`.
- **Schedule:** one `pg_dump` per 24 h via cron (host) or a cron-like CI job
  (`scripts/` exists in repo — create `scripts/backup-db.ps1` or `.sh`).
- **Command shape (before any CI plumbing exists, run manually once):**
  ```powershell
  docker exec -i dravio-db pg_dump -U dravio_user -d dravio_production -Fc -f /tmp/dravio_<date>.dump
  docker exec dravio-db sh -c "ls -la /tmp"
  ```
  (The container id is `dravio-db` per the WSL setup doc; `docker-compose.yml`
  uses `dravio-postgres`. Use whichever is actually deployed.)
- **Copy out** of the container to off-host storage (see §Storage).

### 2. WAL archiving (for point-in-time recovery) — document the need

- Logical dumps only give you the state at dump time. To approach the
  **RPO ≤ 5 min target** you need continuous WAL archiving
  (`archive_command` in `postgresql.conf`) shipping `.wal` segments to the same
  off-host store.
- **Honest note:** with no replica and no managed Postgres, this is real
  work — configure `archive_mode=on`, `archive_command` pointing at storage,
  and add an archive-tailing alert. Do not skip the daily dumps because WAL
  exists; a login-less restore from a fresh volume needs an intact base dump.

### 3. Test-restore procedure (prove it, don't assume it)

The only way to trust the backup is to restore into a disposable container:

```powershell
# 1) Provision a throwaway Postgres with an EMPTY volume
docker run -d --name dravio-restore-test -e POSTGRES_USER=dravio_user `
  -e POSTGRES_PASSWORD=dravio_password -e POSTGRES_DB=dravio_production `
  -p 55432:5432 postgres:16
# 2) Load the schema exactly as production does
docker exec -i dravio-restore-test psql -U dravio_user -d dravio_production < master_init.sql
docker exec -i dravio-restore-test psql -U dravio_user -d dravio_production < backend/migrations/001_hardening.sql
docker exec -i dravio-restore-test psql -U dravio_user -d dravio_production < backend/migrations/002_compliance.sql
# 3) Restore the HEADLINES-only dump (verify counts, then drop it)
docker cp <dump>.dump dravio-restore-test:/tmp/d.dump
docker exec dravio-restore-test pg_restore -U dravio_user -d dravio_production --clean --if-exists /tmp/d.dump
```
Acceptance checks for the drill:
- `pg_restore` exits 0.
- Row counts match pre-drill (`SELECT (SELECT count(*) FROM payments.transactions), (SELECT count(*) FROM billing.wallets), (SELECT count(*) FROM auth.users);` — table list per `master_init.sql:3-9`).
- One completed payment's ledger + `compliance.transaction_events` rows exist (the CAS trail must survive).
- Throwaway container deleted: `docker rm -f dravio-restore-test`.

### 4. Storage location

- Off-host, off-machine, encrypted at rest: S3 (or a compatible bucket) via
  `pg_dump -Fc` upload after dump. If none exists yet, the **smallest real
  alternative** is a different physical drive + retention of the last 7 dailies —
  document the limitation that a same-device copy is not disaster recovery.
- Retention target: 7 daily + 4 weekly (planning value; tune to counsel on
  `compliance.retention_rules` — note `analytics.metrics`/`analytics.session_telemetry`
  have their own retention policy in `002_compliance.sql:107-108`).
- Put dump credentials in a `.env`-style secret store or CI secret — never in
  git (repo policy: real secrets only in the deployment platform,
  `security-architecture.md`).

### 5. Restore runbook (operational steps when the day comes)

1. Stop writes: pause the backend (or put it behind a 502) so apps see
   `BAD_GATEWAY` (`index.ts:89-102` maps upstream errors to 502) instead of
   mid-write corruption.
2. Provision a fresh Postgres with an **empty** volume (same base image).
3. Re-apply schema from git (`master_init.sql` → 001 → 002) **before** data.
4. `pg_restore` the newest dump (`--clean --if-exists`), tail `--no-owner
   --no-privileges` if the dump user differs.
5. Point the backend at the new `DATABASE_URL` (Render/Railway env var), restart.
6. Verify the smoke path from the drill; then resume writes.
7. Record duration → compare against the RTO target.

### 6. Automation to schedule once the manual drill passes

- cron entry (host) or scheduled CI job to run the dump; `find | Remove-Item`
  style prune older than retention; upload to the bucket.
- Add to the CI/lint-adjacent matrix an end-to-end restore smoke (step 3)
  — this both proves the mechanism each week and prevents "the backup was
  corrupt" discoveries the day you need it.

---

## What is NOT covered here (build after the above)

- Managed Postgres (Render free plan gives a single DB, no replica —
  `render.yaml:92-96`).
- Point-in-time for the Redis side (out of scope; ephemeral by design).
- Kafka replay (no retention strategy exists; events are best-effort).
- A "backup service" inside the DRAVIO app itself — this is infra, keep it out
  of `backend/src`.

## Verification checklist (update after each drill)

- [ ] `pg_dump` completes and file has nonzero size
- [ ] Upload to off-host storage succeeded
- [ ] Fresh-container restore returned exit 0
- [ ] Row-count smoke passed
- [ ] `<newest dump>` copied to at least 2 locations
- [ ] Duration < RTO target (current ESTIMATE ≤ 1 h mid-week)