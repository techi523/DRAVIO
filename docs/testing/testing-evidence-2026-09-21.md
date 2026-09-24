# DRAVIO — Testing & Verification Evidence

Date: 2026-09-21
Host: Windows, Node v24.18.0, npm 11.16.0
Author: opencode (`big-pickle`), automated audit pass

This document records what was actually executed in this environment, with the
raw result, vs. what could not be executed and the exact prerequisites required.
Nothing here is asserted without a command or code reference.

Legend: **PASS** = executed and observed · **NOT VERIFIED** = runnable but not run here · **BLOCKED** = prerequisite missing · **NOT CONFIGURED** = credential/infra absent.

---

## 1. Backend — build and unit tests

Command: `npm run build` (tsc) in `backend/`

```
> @dravio/backend@1.0.0 build
> tsc
```

Result: **PASS** — no type errors, no emit failures.

Command: `npm test` (`tsx --test tests/*.test.ts`) in `backend/`

```
✔ computeFees applies 20% platform fee and rounds to cents (3.8516ms)
✔ computeFees handles small sub-cent amounts without negatives (1.0371ms)
✔ computeFees never overshoots the amount (fee <= amount) (0.8854ms)
✔ getPlatformFeePct clamps out-of-range config to default (0.9191ms)
✔ settleCentCarry does not lose sub-cent charges across reports (1.1029ms)
✔ settleCentCarry preserves exact cent multiples (0.5257ms)
✔ OTP send+verify succeeds with the delivered code (8.8311ms)
✔ OTP with wrong code fails (1.5637ms)
✔ OTP is single-use (consumed after success) (1.3611ms)
✔ OTP attempt limit blocks guessing after 5 tries (7.1166ms)
✔ OTP for unknown phone number fails (3.0601ms)
✔ unauthenticated request is rejected with 401 (no fabricated admin) (125.0624ms)
✔ a normal buyer cannot access admin endpoints (403) (24.4341ms)
✔ a token holding SUPER_ADMIN role is allowed (20.7159ms)
✔ a token holding the generic ADMIN role is allowed on any admin function (14.2516ms)
✔ a tampered token is rejected (401) (19.2341ms)

ℹ tests 16 · pass 16 · fail 0 · duration_ms ~2909
```

Result: **PASS 16/16** — money math (fee, sub-cent carry), OTP lifecycle
(random/mock/limits), and admin RBAC (401/403/allow/tamper) all green.

Coverage caveat: the suite is unit/route-level. It does **not** exercise a live
Postgres/Redis instance (see §5). No test asserts the marketplace/relay
fail-closed path against a live Redis; that path is covered by code inspection.

---

## 2. buyer-web — production build

Command: `npm run build` (`next build`) in `apps/buyer-web/`

```
▲ Next.js 15.5.25
 ✓ Compiled successfully
 ✓ Generating static pages (16/16)
Route (app)                     Size     First Load JS
○ /                            3.61 kB   122 kB
○ /marketplace                 5.48 kB   124 kB
○ /session                     4.26 kB   123 kB
○ /wallet                      5.44 kB   124 kB
○ /privacy                     127 B     103 kB
ƒ Middleware                   104 kB
```

Result: **PASS**. This build also ran Next.js's own TypeScript validity check
(`Linting and checking validity of types`) and caught a real null-safety error
during the pass (`'b.avg_speed' is possibly 'null'` at `src/app/page.tsx:33`),
which was fixed; the re-run passed clean.

---

## 3. admin-portal — production build

Result: **PASS** (verified earlier in this session, under SWC, after the A35
`.babelrc` removal). Not re-run in this final step; no admin-portal source files
change in this pass affect it. The backend `/v1/admin/*` dual-mount it depends on
is covered by the backend build.

---

## 4. mobile-app — static verification

Command: syntax transpile of every edited `.ts/.tsx` via `ts.transpileModule`.

Result: **PASS** — all edited mobile files parse ("ALL SYNTAX OK").

Full type-check (`npx tsc --noEmit`) — **BLOCKED**:
- `apps/mobile-app/node_modules` is **ABSENT** in this environment.
- Without it, `tsc` fails on unresolved `react-native`, `expo`, `@react-navigation/*`, etc. (cascade of pre-existing environment errors, not source defects).
- To unblock: `npm install` inside `apps/mobile-app` on a machine with the RN/Expo toolchain, then `npx tsc --noEmit`.

Native tunnel surface (inspected, not runtime-verified):
- `apps/mobile-app/package.json` declares `react-native-wireguard-vpn: ^1.0.22`.
- `metro.config.js` redirects that module to `src/mocks/wireguard-mock.js` **on web/Expo Go only**.
- The mock throws `[DRAVIO FATAL] WireGuard mock invoked in a PRODUCTION build` when `!__DEV__`, so it fails closed rather than faking a tunnel.
- A real tunnel therefore requires a custom dev/standalone native build tested on a device/emulator — see §5. Expo Go/web cannot validate this.

---

## 5. Blocked / not configured on this host

Verified prerequisites on this machine:

```
node --version         -> v24.18.0
npm --version          -> 11.16.0
where adb              -> adb ABSENT
ANDROID_HOME           -> UNSET
ANDROID_SDK_ROOT       -> UNSET
java -version          -> java ABSENT
apps/mobile-app/node_modules -> ABSENT
backend/.env           -> MISSING
.env (root)            -> MISSING
```

### 5.1 Live mobile E2E (two-instance session + billing) — **BLOCKED**
Missing: Android SDK platform-tools (`adb`), an emulator/AVD (e.g. API 35 image),
a JDK/JVM. No `ANDROID_HOME`/`ANDROID_SDK_ROOT`.
Required to unblock:
1. Install Android Studio + SDK; add `platform-tools` to PATH; set `ANDROID_HOME`.
2. Create an API 35 AVD; `emulator -avd <name>`.
3. `apps/mobile-app`: `npm install` then `npx expo start --android` (or a dev build).
4. Run a second emulator/instance for seller + buyer; execute
   start-session → usage report → end-session and assert wallet debits/credits.

### 5.2 Live payments (Stripe / M-Pesa) — **NOT CONFIGURED**
Missing: live/sandbox Stripe keys + webhook secret, M-Pesa consumer key/secret/passkey + HTTPS callback URL.
Nothing was charged or credited outside unit tests. The credit path is
transaction-scoped per `backend/src/modules/payment` (code-inspected; not runtime-verified against a live provider).

### 5.3 Live Postgres/Redis integration — **NOT VERIFIED**
`backend/.env` (and root `.env`) are absent, so no `DATABASE_URL`/`REDIS_URL`.
The server was not booted against a live DB in this pass. Required: provision
Postgres (apply `master_init.sql` + `backend/migrations/*`) and Redis, populate
`.env`, then run a smoke script (register → payment → session start → usage →
end → assert balances).

### 5.4 Live relay hardware — **NOT CONFIGURED**
No physical relay is registered, so real tunnels cannot be established. The
contract now supports registering one (`POST /v1/marketplace/heartbeat` with
`relay.endpoint` + `relay.publicKey`). Until then, buyers correctly receive
`409 SELLER_RELAY_NOT_REGISTERED` instead of a fabricated config. This is the
intended fail-closed behavior, not a defect.

---

## 6. Summary matrix

| Area | Command / method | Result |
|---|---|---|
| Backend compile | `npm run build` (tsc) | **PASS** |
| Backend unit/route tests | `npm test` | **PASS 16/16** |
| buyer-web build + TS check | `next build` | **PASS** |
| admin-portal build | `next build` | **PASS** (earlier this session) |
| mobile syntax | `ts.transpileModule` | **PASS** |
| mobile full type-check | `tsc --noEmit` | **BLOCKED** (no node_modules) |
| mobile live E2E | emulator + 2 instances | **BLOCKED** (no SDK/adb/JVM) |
| Live payments | Stripe/M-Pesa | **NOT CONFIGURED** |
| Live Postgres/Redis | boot + smoke | **NOT VERIFIED** (no env) |
| Live relay tunnel | real hardware | **NOT CONFIGURED** (fail-closed verified in code) |
