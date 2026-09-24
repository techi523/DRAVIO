# DRAVIO Testing Architecture

Status date: 2026-09-21. Runs executed on Windows host with a real Android
emulator (AVD `dravio-test`, API 36) driving the actual app bundle.

## Layers

1. **Unit / static (fast, offline, always runnable)**
   - Backend pure-logic suites: `backend/tests/*.test.ts`, run with the Node
     test runner via `tsx --test tests/*.test.ts`.
   - Pure modules live in zero-dependency seam files so they are importable
     without booting fastify/redis/kafka/pg:
     - `backend/src/modules/session/access.ts` — session ownership (owner or
       OPERATOR roles) + fail-closed VPN config building.
     - `backend/src/modules/billing/core/billing-decision.ts` — billing
       decision (replay guard, fractional-cent carry, cent-exact settle,
       fee-agnostic money movement).
     - `backend/src/modules/billing/core/session-gate.ts` — session-open
       validation (seller → hardware → server price → min balance).
     - `backend/src/modules/payment/money.ts` — cent arithmetic, fee split
       (`PLATFORM_FEE_PCT`), carry settlement.
     - `backend/src/modules/auth/security.ts` — device fingerprinting + risk
       scoring.
   - Compile checks: backend `tsc`, buyer-web `next build`, admin-portal
     `next build`, mobile `tsc --noEmit`.

2. **Mobile E2E (real device, offline platform)**
   - Harness: `docs/testing/emulator-test-harness.ps1` (preflight, install,
     launch, walkthrough, crash scan, memory).
   - Driver: `docs/testing/mobile-ui-driver.ps1` (uiautomator node lookup,
     binary-safe screenshots, IME-aware typing, retry helpers).
   - Live platform parts: bundled app renders the REAL auth screens served by
     Metro; sign-in/register correctly fail with the app's own
     "Cannot reach the server" validation because no backend is reachable —
     this is PASS-for-honest-behavior, not a mocked success.

3. **Web E2E (Playwright) — blocked on live backend**
   - `tests/e2e.spec.ts` + `packages/e2e-tests` exist; require a reachable API
     with seeded DB state.

4. **Integration / API / database / security-live / payments-live — blocked**
   - No `backend/.env` (`DATABASE_URL`, `REDIS_URL`), no server on
     `127.0.0.1:8080` or `api.dravio.app`; no gateway credentials; no
     provisioned relay. See `TEST_PLAN.md`.

## Seam conventions

Exported pure helpers must have NO imports from service modules (`db/*`,
`events/*`, repositories that touch pg pools, fastify plugins). When a
behavior needs unit coverage, extract it into such a seam, make the production
code call it, and keep the production behavior byte-identical (same gate order,
same error codes/statusCodes, same money rounding). Tests are written against
the seams; the honest limit of a seam is that it exercises the pure logic, not
the I/O side.

## Reporting rules

- PASS requires executed evidence (a command, its exit code, and where
  results/screenshots live).
- FAIL requires the failing output and a fix attempt record; suites stay red
  until fixed.
- BLOCKED records exactly which infrastructure is missing and what is needed to
  unblock.