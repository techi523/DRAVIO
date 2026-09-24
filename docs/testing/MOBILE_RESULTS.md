# MOBILE RESULTS — DRAVIO Android (Emulator E2E)

Date: 2026-09-21
Method: **real interaction, no mocks, no fabricated results.** The app was built from source
(`app-debug.apk`), installed on an API-36 emulator, and driven through its real UI with adb
(taps + text input). Every PASS/FAIL is backed by artifacts: PNG screenshots, uiautomator XML
hierarchy dumps, logcat, and meminfo captured from the running device.

## Environment

| Item | Value |
| --- | --- |
| Build | `apps/mobile-app` debug APK (`expo prebuild` → Gradle 9.0.0) |
| APK | `apps/mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| Device | `emulator-5554`, AVD `dravio-test`, `system-images;android-36;google_apis;x86_64`, headless |
| JS runtime | React Native dev build serving the JS bundle over Metro (`:8081`, `adb reverse`) |
| Host | Windows 11, 8 GB RAM (resource-starved — see Notes) |
| Evidence | `docs/testing/emulator-evidence-20260921-101519/`, `ui-walkthrough-{login,register,signup,restart}/`, `emulator-test-harness.ps1`, `mobile-ui-driver.ps1` |

## Results

| # | Test | Result | Evidence |
| --- | --- | --- | --- |
| T1 | APK installs & launches (cold start) | PASS | `adb: install -r` Success; `pm list` = `com.dravio.app`; first bundle cold start `WaitTime 17.3s`; warm relaunch `3.5s`; process alive, `mFocusedApp=com.dravio.app/.MainActivity` |
| T2 | Auth screen renders authentically | PASS | Real text nodes: `DRAVIO · DECENTRALIZED INTERNET MARKETPLACE · Continue with Phone · EMAIL · PASSWORD · LOG IN · Don't have an account? Sign Up` (`login-1-email.png`) |
| T3 | Empty submit → client-side validation | PASS | App shows `"Please enter your email and password."` (no request is sent on empty input) |
| T4 | Valid credentials + unreachable API → honest error | PASS | `"Cannot reach the server. Check your connection."` shown; **no fake success, no session created** (`login-3-after-submit.png`, `login-2-after-submit.png`) |
| T5 | Sign Up navigation → Register screen | PASS | `CREATE YOUR ACCOUNT` screen with role toggles, Terms, `CREATE ACCOUNT` (`signup-1-after-tap.png`) |
| T6 | Weak password rejected client-side | PASS | Feed `password123` → `"Password must contain an uppercase letter."` (validation enforced before network) |
| T7 | Valid registration + unreachable API → honest error | PASS | Real submit (BUY DATA role, Terms ✓ via real taps) → `"Cannot reach the server. Check your connection."` (`register-2b-after-submit.png`) |
| T8 | Cold restart state handling | PASS | Force-stop → relaunch → fresh anonymous login screen; **no stale session restored** (`restart-1-relaunch.png`) |
| T9 | Stability (crash scan) | PASS | `FATAL EXCEPTION`/`AndroidRuntime` for `com.dravio.app`: **0** across the session |
| T10 | Runtime footprint | INFO | `TOTAL PSS 251,882 KB / RSS 377,880 KB` at idle on auth screens |
| T11 | Full business flows (marketplace, purchase, tunnel, wallet) | **BLOCKED** | Require the live DRAVIO backend + Postgres/Redis + relay services. Probes on host: `127.0.0.1:8080` DOWN, `https://api.dravio.app/v1/health` DOWN. Real registration/login cannot succeed until a backend is reachable — by design, no fake data was used. |

## Observations

- **Honest-state verification**: the app consistently surfaced genuine network failures rather
  than inventing success. This is the behavior we want verified before any release.
- **No crash of the DRAVIO process**. The emulator's stock apps (`com.google.android.apps.wellbeing`,
  `com.android.systemui`, bluetooth) hit ANR/errors under RAM pressure (8 GB host); these are unrelated
  to DRAVIO and were mitigated by disabling stock services (`pm disable-user` / `svc bluetooth disable`).
- Kotlin deps (`react-native-wireguard-vpn`) are pure-Java; no NDK required; GateKeeper/WireGuard
  tunnel tests remain BLOCKED until a live relay + backend exist.

## Reproducibility notes (documented to prevent false failures)

- Binary pipelines are corrupted on Windows (`adb exec-out … > file` writes UTF-16) — always
  `adb shell screencap -p /sdcard/x.png && adb pull` (bizarre PNG headers otherwise, e.g. `89 50 4E 47 0D 0D 0A`).
- A PowerShell function parameter named `$args` collides with the automatic variable and silently
  empties the binding, breaking `Invoke-Adb`/`Adb` helpers — use a non-colliding name.
- Opening the IME shifts the layout (RN `KeyboardAvoidingView`); node coordinates must be re-located
  after each IME toggle, never hard-coded across keyboard states.
- `adb input text` mis-handles some characters and case on this image for keycode injection; the driver
  types letter runs via `input text` and only `@`/`.` via keycodes — verified by re-reading field values.
- Android LMK kills a *backgrounded* DRAVIO during guest memory pressure; keep the app foregrounded
  during deep flows, and re-tap to restore focus rather than assuming the process died.
---

## Live re-verification session (2026-09-22)

End-to-end harness re-run with fixes; emulator is working and live.
Primary evidence: `docs/testing/emulator-evidence-20260922-051109/` (REPORT.md,
result.json, 6 PNGs, 6 XML dumps, logcat-full.log, meminfo.txt).

### This session fixed / verified
1. **Build now works from the harness.** Root cause of the old `exit 9009`:
   `gradlew.bat` aborts when `JAVA_HOME` is unset and `java` is not on PATH.
   Harness now resolves a JDK � honors the project's
   `org.gradle.java.home` (resolved `C:/Users/Admin/AppData/Local/Programs/jdk-17.0.20.1+1`),
   then Android Studio JBR, then Adoptium/user JDKs. `assembleDebug` success,
   fresh 55.1 MB `app-debug.apk` built and installed (`Success`).
2. **First-cold-start ANR death eliminated.** After installing a fresh 55 MB
   debuggable build, the app reliably died with
   `ANR in com.dravio.app � failed to complete startup` (killed adj 0): JIT
   verification + Metro bundle fetch exceeded the ~10 s startup window under
   swiftshader. Fixed with `adb shell cmd package compile -m speed -f
   com.dravio.app` (AOT). App now boots to focused `MainActivity` in < 25 s.
3. **Hanging Metro diagnosed and replaced.** Port stayed "listening" while HTTP
   requests timed out; the app rendered blank waiting for a bundle. Killed the
   stale node PID, restarted `npx expo start --port 8081` (note: this expo
   build does NOT accept `--no-interactive`), confirmed
   `packager-status:running`, waited for the 46 s first bundle (1044 modules),
   relaunched � real UI rendered (`Running "main" ... fabric:true`).
4. **Harness hardening (this session).**
   - JDK auto-resolve + recording (`JDK resolved` PASS).
   - `$home`?`$initialUi` rename: fixed a PowerShell automatic-variable
     collision (`$HOME` is read-only) that previously made "Initial screen
     render" print the Windows home path `C:\Users\Admin` instead of UI text.
   - Launch check polls `topResumedActivity` (was `mCurrentFocus`, which this
     API level no longer emits) ? `App launched` PASS.
   - `UiDump` retries (4x5 s) to ride out uiautomator "null root node" during
     JS boot.
   - `WaitForAppContent` refocuses the app and waits until the dump shows the
     app's own text (excludes the launcher page) ? initial + tab renders PASS.
   - `EnsureAppForeground` + tab taps moved to y=0.94 so taps land in-app,
     not on the gesture-nav region (was homing out to the launcher).
   - `node_modules` detail now reports the path (was the misleading
     "npm install required").

### Result (2026-09-22 05:11, full run)
- Preflight: adb/emulator PASS; JDK resolved PASS; node_modules PASS;
  Metro :8081 PASS (node); device online SDK=36 x86_64; gateway ping PASS.
- API local/prod DOWN (honest � no backend provisioned).
- `App launched` PASS � `ResumedActivity ... com.dravio.app/.MainActivity`.
- `Initial screen render` PASS � real auth UI:
  `DRAVIO | DECENTRALIZED INTERNET MARKETPLACE | G Google | Apple | GH GitHub |
  M Microsoft | Continue with Phone | or continue with email | EMAIL |
  you@example.com | PASSWORD | Your password | LOG IN | Sign Up`.
- Tabs 1�5 render: PASS (same real auth UI, stable across taps).
- logcat crash scan: PASS (no FATAL EXCEPTION / JS errors).
- meminfo: TOTAL PSS 226,135 KB / RSS 348,144 KB.
- Artifacts: 6 screenshots, 6 UI dumps, logcat, meminfo, REPORT.md, result.json.

## Live-backend connectivity session (2026-09-22, ~11:00)

Symptom reported by user on the running emulator: `"Cannot reach the server. Check your connection."`
on every LOG IN submit even though the app renders fine.

### Root cause (two compounding facts, both fixed)
1. **No backend was listening on the host.** `backend/` had never been started on this machine.
   Started the real server with only its single required env var (fail-fast schema in
   `backend/src/config/env.ts`): `JWT_SECRET` (random 48-char dev value), `NODE_ENV=development`,
   `PORT=8080`, run as `tsx src/index.ts` from `backend/`. Result:
   `Server listening at http://0.0.0.0:8080`, `/health` -> `{"status":"ok",...}`; DB/Redis/Kafka
   log warnings and background consumers fail soft (`.catch`) — server stays up. Process: node
   (19240), logs in `%TEMP%\opencode\backend.{out,err}.log`.
2. **The dev build's API base is `http://localhost:8080/v1`, not `10.0.2.2:8080`.** In
   `apps/mobile-app/src/services/api.ts` `resolveApiUrl()`: when the packager scriptURL is an
   `exp://...` URL (dev client), the `https?://` LAN-ID branch is skipped and it falls through to
   the `__DEV__` default `http://localhost:8080/v1`. `localhost` on the emulator is the *device's
   own* loopback, so requests died there (an OkHttp thread name / backend `req` host reporting
   `localhost:8080` confirmed this on the wire). Fix, no code change:
   `adb reverse tcp:8080 tcp:8080` (device-localhost:8080 -> host:8080).
   Note: `10.0.2.2:8080` and the host LAN IP (`10.130.4.240:8080`) were BOTH verified reachable
   from the guest (nc GET /health -> HTTP 200) — the app simply was not pointed at them.

### Proof (real interaction, no mocks)
- Backend log receives the app's actual `POST /v1/auth/login`
  (`req-7`/`req-8`, hostname `localhost:8080`, remoteAddress `127.0.0.1`), then
  `AuthRepository.findByEmail` -> `pg-pool` `ECONNREFUSED ::1/127.0.0.1:5432` -> real HTTP **500**.
- App's on-screen message changed from
  `⚠️ Cannot reach the server. Check your internet connection.`
  to
  `⚠️ INTERNAL_SERVER_ERROR`
  — i.e. the app is now talking to the real server and rendering the server's genuine response.
- Config: `EXPO_PUBLIC_API_URL` unset (confirmed via shell env + bundle grep — no literal
  `https://api.dravio.app/v1` in the served dev bundle; only contact/privacy strings).
- Evidence: driver evidence dir `docs/testing/emulator-evidence-20260922-083959/`
  (login-3-after-submit.png); screenshots show the real server error replacing the network error.

### Remaining blocker to a successful login
- A real Postgres is still required. Repo has the full schema (`DRAVIO/master_init.sql` +
  `backend/migrations/001_hardening.sql`), but Docker Desktop runs no Linux containers yet
  (WSL2 not installed on this host) and no native PostgreSQL is present, so
  `DATABASE_URL` cannot be provided locally. Until then login/register correctly return the
  server's honest 500 (INTERNAL_SERVER_ERROR). Redis optional (caching only).
