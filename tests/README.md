# tests/ — Automated Test Suite Map

Executable fast suites (run from repo root):

| Command | Layer | Runs | Status |
|---|---|---|---|
| `npm run test:unit` | Backend unit/business/security (pure logic) | `npm --prefix backend test` → `tsx --test tests/*.test.ts` | PASS (37/37, ~2.5s) on 2026-09-21 |
| `npm run test:build-backend` | Static (tsc) | `npm --prefix backend run build` | PASS |
| `npm run test:build-buyer` | Static (next build) | `npm run build -w apps/buyer-web` | run-on-demand |
| `npm run test:build-admin` | Static (next build) | `npm run build -w apps/admin-portal` | run-on-demand |
| `npm run test:tsc-mobile` | Static (tsc) | `npx tsc --noEmit -p apps/mobile-app/tsconfig.json` | run-on-demand |
| `npm run test:all` | All of the above | unit + build | — |
| `npm run test:e2e-web` | Playwright web E2E | `packages/e2e-tests` | requires live backend+DB |
| `npm run test:mobile` | Android emulator E2E | `docs/testing/emulator-test-harness.ps1` | requires running emulator + Metro |

Infrastructure-dependent suites (BLOCKED until env is provisioned — see `docs/testing/TEST_PLAN.md`):

- Integration/API — needs `backend/.env` (`DATABASE_URL`, `REDIS_URL`) and a reachable `127.0.0.1:8080` / `api.dravio.app`.
- Database — Postgres + Redis connection required.
- Security live (JWKS/permission matrix against real API, BOLA) — API required.
- Payments live (Stripe, M-Pesa) — gateway credentials + webhook tunnel required.
- Relay/tunnel E2E — physical/emulated seller relay node with registered
  `relay_endpoint` + `relay_public_key` required.

Honesty rule: a suite is only reported PASS with real, reproducible evidence.
Anything that cannot be exercised without unavailable infrastructure is
reported BLOCKED — never simulated.

Details: see `docs/testing/testing-architecture.md` and `docs/testing/TEST_PLAN.md`.