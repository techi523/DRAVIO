# PERFORMANCE_RESULTS.md — DRAVIO performance observations

Date: 2026-09-21. Emulator AVD `dravio-test` (API 36, x86_64, swiftshader GPU).
Measurements are real device-behavior samples, not load benchmarks.

## Mobile (Android, real emulator)
| Metric | Value | Notes |
|---|---|---|
| Cold start `WaitTime` (first bundle) | 17.29 s | Includes Metro bundle fetch + JS realm init |
| Warm start `WaitTime` | 3.49 s | Relaunch w/ cached bundle |
| `com.dravio.app` TOTAL PSS | ~251,882 KB | `dumpsys meminfo` |
| RSS (native heap, mapped) | ~377,880 KB | same dump |
| crashes in session | 0 | 0 FATAL EXCEPTION / AndroidRuntime lines |
| Stabilized free RAM (guest) | >1.5 GB after disabling Wellbeing + Bluetooth | stock-app ANRs were the pressure cause |

## Web production builds (next build, telemetry disabled)
| App | First Load JS (shared) | Static route count | Build |
|---|---|---|---|
| buyer-web | 103 kB shared chunks | /, /login, /register, /wallet, /marketplace, /session, /profile, /privacy, /auth/[path] | PASS exit 0 |
| admin-portal | 102 kB | admin routes | PASS exit 0 |

## Backend unit runtime
- `tsx --test tests/*.test.ts`: ~2.5 s direct / ~6.0 s via `npm run test:unit`
  for 37 tests (pure-logic suites only; no I/O).
- Backend `tsc` full build: exit 0 (seconds).

## Blocked benchmarks
Real round-trip latency, throughput, DB query plans, and relay bandwidth
tests are BLOCKED until the API/database are provisioned (see
`TEST_PLAN.md` S4–S9). No synthetic numbers will be reported in their place.