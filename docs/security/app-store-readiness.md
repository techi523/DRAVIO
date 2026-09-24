# DRAVIO — App Store Readiness

**Scope:** readiness of `apps/mobile-app` for submission to the **Google Play Store**
and the **Apple App Store**, grounded exclusively in on-disk audit evidence
(`docs/security/mobile-privacy-audit.md` M-series, `docs/security/policy-integrity.md`
S-01…S-04, `docs/compliance/compliance-matrix.md`, `docs/compliance/FINAL_COMPLIANCE_REPORT.md`).
No runtime, live-store, or device-behaviour claim is made — the mobile audit's
Android emulator was **NOT** run (`mobile-privacy-audit.md:5-9`).

**Status vocabulary (this file only):** `VERIFIED` (control present and evidenced),
`PARTIAL` (present but incomplete/unverifiable), `FAILED` (control absent or
store-blocking), `BLOCKED` (cannot proceed until a dependency fires), `NOT-VERIFIED`
(no evidence either way), `NOT-APPLICABLE`.

**Finding severities are preserved verbatim from the source docs**
(`CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `INFO` — `mobile-privacy-audit.md:11-13`).

> **Conclusion:** DRAVIO is **NOT app-store ready**. Two store-blocking findings are
> open: release-APK signing with the public Android debug keystore (`M-11`, CRITICAL)
> and the absence of any in-app account-deletion path promised by the app's own Terms
> (`M-12`, HIGH — Apple Guideline 5.1.1(v) + Google Play data-deletion requirement).
> No fix in this file is assumed done; every row below is state as evidenced on disk.

---

## 1. Requirement-by-requirement matrix

| Store requirement | DRAVIO status | Verdict | Evidence (doc:line) |
|---|---|---|---|
| **Release artifact signed with production-private key** — Play rejects debug-signed AAB/APK; a public debug keystore lets anyone sign a "genuine" update | `release` signingConfig points at `signingConfigs.debug` (`debug.keystore`, password `android`). No production keystore or CI signing config in repo (R-182 store-release stubs remain PARTIAL). | **FAILED** — store-blocking, CRITICAL | `M-11`: mobile-privacy-audit.md:76 (`build.gradle:100-107,112-115`); register R-054 |
| **In-app account deletion** — Apple 5.1.1(v) ("apps that support account creation must also allow users to initiate deletion within the app"); Google Play Data Safety "data deletion" | No deletion control in any app screen; `Profile.tsx` has none; deletion is reviewer/ADMIN-gated server-side and incomplete (D-06…D-10). In-app Terms *claim* deletion "from the Profile screen" — false. | **BLOCKED** — store-blocking, HIGH | `M-12`: mobile-privacy-audit.md:77; `P-26/P-29`: policy-integrity.md:44,47; register R-055, R-101, R-106 |
| **Wire deletion to backend + hosted web fallback** (Play allows delete-out-of-app as long as there is a mechanism) | Backend DSAR API exists (`POST /v1/privacy/requests`, reviewer flow — `compliance-matrix.md` D-06 PASS); **no app or hosted-web UI calls it**; no hosted fallback URL exists in repo. | **FAILED** — no user-reachable deletion path | `M-15`: mobile-privacy-audit.md:85; `D-17`: risk-register R-096 (BLOCKED) |
| **Play Data Safety form accuracy** | App generates + transmits a persistent `dravio_device_id` as billing `hardwareId`, while privacy text claims "no device identifiers" — declaration would be inaccurate. | **FAILED** | `M-19`: mobile-privacy-audit.md:86 (table MEDIUM; summary counts HIGH) |
| **Privacy policy URL in store listings** | Privacy text exists in-app and in `docs/policies/acceptable-use-policy.md#privacy`; **no externally hosted URL in repo**. | **PARTIAL** | S-04: policy-integrity.md:64 |
| **Disclosure of data categories in listing** | Mobile Privacy screens disclose identity/OS/app-version only; several claims unverifiable or contradicted (heartbeats "anonymised" = MISMATCH; retention durations = MISMATCH; processor/TLS claims = UNVERIFIABLE). | **PARTIAL** | S-03: policy-integrity.md:63; P-22, P-23, P-25, P-32, P-33 |
| **No unusable/store-flagged permissions** | Merged manifest ships `SYSTEM_ALERT_WINDOW` + legacy `READ/WRITE_EXTERNAL_STORAGE` (unused) and `POST_NOTIFICATIONS` without an implementation. | **FAILED** — review-flag surface | `M-16`: mobile-privacy-audit.md:92; register R-059 |
| **Functional Google/Firebase config (if Google services claimed)** | `google-services.json` is a fake placeholder compiled in via the GMS plugin; `eas.projectId` is a slug, not a UUID. Store build outcome NOT-VERIFIED. | **FAILED** | `M-10`: mobile-privacy-audit.md:70; register R-053, R-182 (store-release stubs PARTIAL) |
| **Incrementable versioning + submit pipeline** | `1.0.0` / `versionCode 1` / iOS `buildNumber 1`; `autoIncrement` only in the `production` profile; `submit.production` empty. | **PARTIAL** — blocks release cadence, not submission per se | `M-13`: mobile-privacy-audit.md:78; register R-056 |
| **Signed, pinned OTA updates** | `expo-updates` enabled with `checkAutomatically: ON_LOAD`; no `codeSigning` settings; update host `u.expo.dev/dravio-mobile-app` not pinned. | **FAILED** — OTA integrity absent | `M-14`: mobile-privacy-audit.md:79; register R-057 |
| **Accessibility (iOS/Play review basics)** | Wallet/Relay/Marketplace/Profile interactive controls lack roles/labels; sub-AA contrast; sub-44pt targets. | **PARTIAL** | `M-17`: mobile-privacy-audit.md:99; register R-060 |
| **Private data in screenshots/recents** | No `FLAG_SECURE`/iOS snapshot masking; wallet balance, M-Pesa phone, relay keys visible. | **PARTIAL** | `M-09`: mobile-privacy-audit.md:64; register R-052 |
| **Deep-link handling** | `dravio://` + `https://dravio.app/open` (autoVerify) registered but **never handled** (no `linking` config / `onNewIntent`); surface dead and untested. | **PARTIAL** | `M-05`: mobile-privacy-audit.md:40; register R-048 |
| **Runtime behaviour evidence** (interception, background, VPN module) | Emulator not run; no runtime/interception results claimed; native `react-native-wireguard-vpn` internals NOT-VERIFIED. | **NOT-VERIFIED** | mobile-privacy-audit.md:5-9,143 |

---

## 2. Findings carried forward, by severity (verbatim from source)

| Severity | IDs | Status in this doc |
|---|---|---|
| CRITICAL | M-11 (release signed with debug keystore) | `FAILED` — blocks submission |
| HIGH | M-10 (fake google-services.json), M-12 (no in-app deletion), M-15 (no DSAR/export UI), M-19 (device-ID vs Data-Safety) | `FAILED` (M-10, M-12, M-15, M-19) |
| MEDIUM | M-02 (web localStorage tokens), M-05 (dead deep links), M-09 (screenshots), M-13 (versioning), M-14 (unsigned OTA), M-16 (permissions), M-17 (a11y), M-18 (logout leaves tunnel/session open) | `PARTIAL` / `FAILED` (M-16, M-14) |
| LOW | M-03 (no biometric/2FA toggles), M-04 (no pinning), M-08 (prod console.*), M-20b (committed logcat.txt/screen.png) | `PARTIAL` / `FAILED` (M-20b hygiene) |
| INFO | M-01 (SecureStore — positive), M-06 (no WebView — positive), M-07 (no clipboard — positive), M-20 (no location — positive) | `VERIFIED` (positive controls) |

Source: mobile-privacy-audit.md:114-121, and per-ID rows 25-106. Severity counts in the
source summary differ from policy-integrity's register row for M-19 (table MEDIUM vs
summary HIGH) — both are preserved as written in their sources; the stricter (HIGH)
is the one to plan against.

---

## 3. Not yet evidenced (do not claim readiness on these)

- **Emulator / device runtime audit** — `M-04` let an optional hardening; real
  interception/pinning verification requires a runtime pass (none recorded).
- **`assetlinks.json` on `dravio.app/open`** — autoVerify target reachability
  NOT-VERIFIED.
- **Hosted privacy-policy / data-Safety landing page** — no URL in repo.
- **Store account, DUNS/app-store identifiers, EAS submit credentials** — absent.

---

## 4. Dependency-blocked items (register linkage)

| Blocker | Blocks | Register row |
|---|---|---|
| In-app deletion + hosted web fallback UI | Apple 5.1.1(v), Play data deletion | R-055, R-096, R-101, R-106 (all store rows OPEN/BLOCKED) |
| Real Firebase project + key hygiene | Google sign-in/push build integrity | R-053, R-182 (PARTIAL) |
| Release keystore + CI secrets | Signing | R-054 (OPEN) |

Any patch to the above must be logged through `vulnerability-management.md`
(`FIXED-VERIFIED` with regression evidence) before this file may mark a row
`VERIFIED` — no store-readiness row is treated as fixed without a recorded
verification step (vulnerability-management.md:76-96).

*Static source assessment — not a guarantee of store approval; approval decisions
remain with Google/Apple review.*