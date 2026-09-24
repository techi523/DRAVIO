# TEST_RESULTS.md — DRAVIO automated verification results

Date: 2026-09-21. Host: Windows 10/11, real Android emulator (AVD
`dravio-test`, API 36 google_apis x86_64), Metro :8081.

## Executed suites (all reproducible commands)

### Unit / business logic — PASS
`npm --prefix backend test` → `tsx --test tests/*.test.ts`

| Sub-suite | Cases | Result |
|---|---|---|
| money | — | PASS |
| otp | — | PASS |
| rbac | — | PASS |
| session-state (new) | 10 | PASS |
| billing-decision (new) | 7 | PASS |
| auth-security (new) | 4 | PASS |
| **Total** | **37** | **pass 37 / fail 0 / cancelled 0** (~2.5s direct, ~6.0s via npm) |

### Static / compile — PASS
| Check | Command | Result |
|---|---|---|
| Backend typecheck+build | `npm --prefix backend run build` (tsc) | exit 0 |
| Mobile typecheck | `npx tsc --noEmit -p apps/mobile-app/tsconfig.json` | exit 0 |
| Buyer-web production build | `npm run build -w apps/buyer-web` (next build) | exit 0 |
| Admin-portal production build | `npm run build -w apps/admin-portal` (next build) | exit 0 |

### Mobile E2E (real emulator) — PASS
`docs/testing/emulator-test-harness.ps1` + `docs/testing/mobile-ui-driver.ps1`.
Full results: `docs/testing/MOBILE_RESULTS.md` (T1–T11). Highlights:

- Preflight/device list/sdk 36, gateway ping — PASS.
- App boots from debug bundle, no `FATAL EXCEPTION`/`AndroidRuntime` for `com.dravio.app`.
- Empty login → app message "Please enter your email and password."
- Valid creds, backend unreachable → "Cannot reach the server. Check your connection." (honest failure, no fabricated success).
- Register flow → "CREATE YOUR ACCOUNT"; weak password rejected client-side
  ("Password must contain an uppercase letter."); valid + ToS + unreachable
  backend → same honest server-unreachable message.
- Cold restart → fresh anonymous login screen (persistence reset), new pid.

Evidence dirs: `docs/testing/ui-walkthrough-{login,register,signup,restart}/`,
`docs/testing/emulator-evidence-20260921-101519/`.

### Mobile E2E — live re-verification (2026-09-22) — PASS
Full clean harness run at `docs/testing/emulator-evidence-20260922-051109/`:
build+install `Success` (fresh 55.1 MB app-debug.apk), `App launched` PASS,
initial + Tabs 1–5 render PASS (real auth UI), logcat crash scan PASS,
meminfo TOTAL PSS 226,135 KB. This session also fixed the harness (JDK
auto-resolve, `$home`→`$initialUi` collision, `topResumedActivity` launch
poll, dump retries, gesture-safe taps), ended the Metro hang that blanked
the app (restarted `npx expo start --port 8081`, bundle 1044 modules), and
fixed the first-cold-start ANR death with ART AOT compilation
(`cmd package compile -m speed -f com.dravio.app`). Notes:
`docs/testing/MOBILE_RESULTS.md`.

### Live API connectivity (2026-09-22 ~11:00) — PASS (network layer)
Root cause of the user's "Cannot reach the server" was twofold and is fixed:
(1) no backend was running — started the real `backend/`
(`tsx src/index.ts`, needs only `JWT_SECRET`; DB/Redis/kafka degrade soft);
now serving `http://0.0.0.0:8080`, `/health` OK. (2) the dev build resolves
its API base to `http://localhost:8080/v1` (device loopback, not
`10.0.2.2:8080`) — fixed with `adb reverse tcp:8080 tcp:8080`. Verified
guest→host:8080 reachable on all three target addresses (nc HTTP 200).
Backend now logs the app's real `POST /v1/auth/login`
(`hostname: localhost:8080`) and returns genuine HTTP 500
(`AuthRepository.findByEmail` → pg `ECONNREFUSED`); the app's on-screen
message changed from "Cannot reach the server…" to "INTERNAL_SERVER_ERROR".
Full login/register still BLOCKED by absence of Postgres (schema available:
`master_init.sql` + `backend/migrations/001_hardening.sql`).

## BLOCKED suites (infrastructure absent — never simulated)

| Suite | Missing infra |
|---|---|
| Web E2E (Playwright `tests/e2e.spec.ts`, `packages/e2e-tests`) | reachable backend (`127.0.0.1:8080` and `api.dravio.app/v1/health` down) + seeded DB |
| API / integration | `backend/.env` (`DATABASE_URL`, `REDIS_URL`), running API |
| Database | Postgres/Redis instances |
| Security live (JWKS, live BOLA, rate limits) | S4/S5 infra |
| Payments live (Stripe, M-Pesa) | gateway credentials, callback/webhook tunnel |
| Relay/tunnel E2E | provisioned seller relay (`relay_endpoint`, `relay_public_key` registered) |

Unblocked, each report will be updated with real executed numbers.