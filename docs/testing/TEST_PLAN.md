# DRAVIO Test Plan

Each suite lists: entrypoint, evidence, and current status. Statuses are
`PASS` (real executed run), `FAIL` (red, being fixed), or `BLOCKED` (missing
infrastructure, exactly what is missing).

## S1 Backend unit & business logic (`backend/tests/*.test.ts`)
Sub-suites (status PASS, 37 tests, ~2.5s, 2026-09-21):
- `money.test.ts` — cent arithmetic, fee split, carry settlement.
- `otp.test.ts` — OTP generate/verify.
- `rbac.test.ts` — role permission checks.
- `session-state.test.ts` — VPN config fail-closed (409 on missing relay),
  session access matrix (owner-OK / other-403 / ADMIN+SUPER_ADMIN only),
  session-open gate order and server-side `MIN_SESSION_BALANCE_USD` boundary.
- `billing-decision.test.ts` — replay guard, sub-cent roll-up to whole cents,
  3-report aggregation mirror of wallet accounting, cent-exact settle,
  fee split sums without loss, 500-report carry invariance.
- `auth-security.test.ts` — device fingerprint determinism + tolerance,
  risk-score reprisal.

Evidence: `npm --prefix backend test` → `pass 37 / fail 0`.

## S2 Static checks / builds
- Backend `tsc` — PASS (exit 0), 2026-09-21.
- Buyer-web `next build` — to run (`npm run build -w apps/buyer-web`).
- Admin-portal `next build` — to run (`npm run build -w apps/admin-portal`).
- Mobile `tsc --noEmit` — to run (`npx tsc -p apps/mobile-app/tsconfig.json`).

## S3 Mobile E2E (real emulator)
- Harness `docs/testing/emulator-test-harness.ps1` → PASS (2026-09-21): preflight,
  gateway ping, no app crash, walkthrough PASS, logcat clean, meminfo captured.
- Driver `docs/testing/mobile-ui-driver.ps1`, evidence in
  `docs/testing/ui-walkthrough-{login,register,signup,restart}/`,
  report `docs/testing/MOBILE_RESULTS.md` (T1–T11).
- Behaviors verified with the real Metro-rendered app: empty-login validation,
  server-unreachable on valid creds (no fake success), client-side password
  strength, account-role + ToS registration flow, cold-start persistence.

## S4 Web E2E (Playwright)
- `tests/e2e.spec.ts`, `packages/e2e-tests`. BLOCKED: requires a reachable
  backend with seeded data (`127.0.0.1:8080` / `api.dravio.app` currently down;
  no `.env`, no `DATABASE_URL`/`REDIS_URL`).

## S5 Integration / API
- Fastify instance against Postgres+Redis. BLOCKED: no database/redis
  connection and no running API (see S4).

## S6 Database
- Migrations, repository CRUD, session usage update path (`updateSessionUsage`
  only where ACTIVE; `endSession` CLOSED/KILLED). BLOCKED: Postgres unavailable.

## S7 Security
- Unit (PASS): session IDOR matrix via `canAccessSession`; VPN config fails
  closed; fingerprinting; gate order.
- Live (BLOCKED): JWKS token validation, live BOLA attempts against session
  handoff/end endpoints, rate limits — requires S4/S5 infra.

## S8 Payments
- Unit (PASS): rent per-byte decisions, fee splits, cents exactness.
- Live (BLOCKED): Stripe checkout/refund webhooks, M-Pesa STK — no gateway
  credentials or callback tunnel configured.

## S9 Business / relay E2E
- BLOCKED: no provisioned seller relay (`relay_endpoint`/`relay_public_key`
  registered in DB). Sessions terminate at closed validation by design
  (`SELLER_RELAY_NOT_REGISTERED` → 409).

## Reports
See `docs/testing/MOBILE_RESULTS.md`; final aggregation to be written to
`docs/testing/TEST_RESULTS.md`, `SECURITY_RESULTS.md`,
`PERFORMANCE_RESULTS.md`, `FINAL_TEST_REPORT.md` after S2 + blocked-classification.