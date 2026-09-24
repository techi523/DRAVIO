# DRAVIO Mobile App — Security & Privacy Audit

**Target:** `apps/mobile-app` — Expo SDK 55 / React Native 0.83 (Android + iOS + web target).
**Method:** Static, source-only audit. Evidence is anchored to `file:line` with snippets.
**Disclaimer:** The Android emulator was **NOT run** for this audit; no runtime/interception
results are claimed or fabricated. `logcat.txt` in the repo is a captured, static device
log and was inspected only as a file. Native-module internals
(`react-native-wireguard-vpn`, `expo-secure-store` OS backends) and server-side enforcement
are marked **NOT VERIFIED** where applicable. No code was modified.

**Severity legend:** `CRITICAL` (store-blocking / key compromise), `HIGH` (exploitable or
store/safety critical), `MEDIUM` (real risk, limited impact), `LOW` (hardening),
`INFO` (observation / positive control).

**Status legend:** `IN-APP` = fixable in application code; `NATIVE/OS` = needs native
(mod gradle/manifest) or OS work; `CONFIG` = build/store/metadata; `BACKEND` = needs server
change; `DOC` = policy/store text.

---

## 1. Secure storage of tokens

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-01 | INFO | `src/services/storage.ts:1-12` — `import * as SecureStore from 'expo-secure-store'`; `getItem` → `SecureStore.getItemAsync`, `setItem` → `SecureStore.setItemAsync`. `AuthContext.tsx:60-65` `login()` replaces only token/user keys. `api.ts:64,90,106,113` reads a single `dravio_token` and attaches it as `Authorization: Bearer …` | Positive control. Tokens are stored in Android Keystore / iOS Keychain via Expo SecureStore — **not** plaintext `AsyncStorage` (no `@react-native-async-storage` dependency in `package.json:20-46`). `android:allowBackup="false"` (`app.json:68`, `AndroidManifest.xml:21`) prevents ADB/cloud backup exfiltration. Single-token design: the app persists one bearer and reuses it as the refresh credential (`api.ts:64,74`), so there is no second, less-protected refresh token. | Keep; consider splitting access vs refresh tokens if the backend issues both. | IN-APP |
| M-02 | MEDIUM | `src/services/storage.ts:8-18` — `if (isWeb) { return localStorage.getItem(key); }` / `localStorage.setItem(key, value)` | The Expo app also ships a **web** target (`app.json:71-74`, `react-native-web` in `package.json:43`). On web, `dravio_token`, `dravio_user`, and `dravio_device_id` live in `localStorage`, readable by any script on the origin (XSS → session theft), mirroring the buyer-web finding (see `docs/security/data-lifecycle-audit.md`). There is no httpOnly-cookie alternative for the RN web bundle. | For web, persist tokens via SameSite/httpOnly cookies issued by the backend, or at minimum scope storage and audit script injection surface. | IN-APP + BACKEND |
| M-03 | LOW | `app.json:76` — `"expo-secure-store"` listed with **no options** (no `requireAuthentication`, no `keychainAccessible`). `Profile.tsx:267-275` — "Biometric Login" `Switch` only does `storage.setItem('dravio_pref_biometric', val ? '1':'0')`; `Profile.tsx:277-279` "ROTATE ENCRYPTION KEYS" only shows `Alert.alert('No Relay Key Store', …)`. `Profile.tsx:152-153` labels this UI "Security Vault · 2FA and Encryption keys" | SecureStore is readable whenever the device is unlocked — no `requireAuthentication`, and the app never calls `LocalAuthentication`. The biometric/2FA toggles persist flags but do **not** enable any actual biometric or 2FA gate; users can reasonably believe 2FA/biometric protection is active when it is not. | Add `requireAuthentication: true` to SecureStore options; implement real 2FA/biometric flows on the matching toggles (or hide them). | IN-APP + NATIVE/OS |

## 2. Certificate pinning

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-04 | LOW | No pinning code exists: grep for `rejectUnauthorized | sslPinning | certificatePinning | pinnedCertificate | strictSSL` → 0 matches across the app. All traffic uses stock `fetch` (`api.ts:121`) and `socket.io-client` (`socket.ts:37-45`, `transports:['websocket']`). Main manifest enforces `android:usesCleartextTraffic="false"` (`AndroidManifest.xml:21`) and `app.json:85` sets the same. Debug-only: `src/debug/AndroidManifest.xml:6` sets `usesCleartextTraffic="true"` (not shipped) | Default system trust store only — a user-installed CA can MITM API/WS/TLS traffic. Also **NOT VERIFIED**: no `REQUIRE_PROVIDED_FILES`/native okhttp config pins anything. Acceptable for most apps but noteworthy for a payment + VPN-metadata app. | (Optional hardening) Use `out-of-band` pin via expo-build-properties okhttp config or a native SSL pinning module; rely on HSTS-equivalent. | NATIVE/OS |
| M-17 | MEDIUM | Dev fallbacks hardcode cleartext HTTP: `api.ts:22,35,41` return `http://…` URLs and `socket.ts:18` returns `http://localhost:8080` for the web target; `src/debug/AndroidManifest.xml:6` permits cleartext | If any debug/preview APK (`eas.json:7-19` builds `distribution:"internal"`, `buildType:"apk"`) is distributed, all API + WS + token traffic is transmitted in cleartext and trivially intercepted. Fine for local dev, unsafe if leaked. | Gate cleartext URLs behind `__DEV__` *and* an explicit local config; never distribute debug artifacts. | IN-APP + NATIVE/OS |

## 3. Deep links

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-05 | MEDIUM | `app.json:8` declares custom scheme `"dravio"`; `app.json:50-66` registers `https://dravio.app/open` with `autoVerify: true`. Generated `AndroidManifest.xml:32-43` registers **both** `dravio://` (line 36) and `https://dravio.app/open` cross-verified intent filters. But `App.tsx:195,215` — both `NavigationContainer` instances pass theme only, **no `linking` config**; `MainActivity.kt:13-20` has no `onNewIntent` override to forward URLs | Registered deep links are **never consumed**: nothing parses the URI, so there is no parameter-injection/`navigation.navigate(route)` attack today. However the surface is dead and misleading: any app can cold-launch the app via the arbitrary `dravio://` scheme, and `autoVerify` requires a reachable `assetlinks.json` on `dravio.app/open` (NOT VERIFIED server-side). When linking is added later, params must be validated and authenticated. | Either implement React-Navigation `linking` + `onNewIntent` with route allow-listing and auth checks, or remove the intent filters/scheme. | IN-APP + NATIVE/OS |

## 4. WebViews

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-06 | INFO | No `react-native-webview` in `package.json:20-46`; grep for `WebView | html | javascript injection | file:// | mixed content` → no matches. The only external-content link is `VpnDisclosure.tsx:102` `Linking.openURL('https://dravio.app/privacy')` → default **system browser** | No embedded WebView attack surface (no JS bridge, no `file://` access, no remote-HTML injection surface). `usesCleartextTraffic="false"` in the main manifest prevents mixed content at the OS level. | Preserve WebView-free posture. | — |

## 5. Clipboard

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-07 | INFO | Grep for `Clipboard | setString | copy` → 0 matches; `react-native-clipboard` / `expo-clipboard` not in `package.json`. Wallet flows never copy payment refs, M-Pesa refs, or tokens (`Wallet.tsx:96-129` deposit, `:152-164` withdraw, `Marketplace.tsx:93-102` session token is passed to the native tunnel, not the OS clipboard) | No clipboard exposure of secrets/payment references from the mobile app. (Contrast buyer-web, out of scope, which copies WireGuard configs — see existing `docs/security/mobile-security-audit.md` M-21.) | Preserve. | — |

## 6. Logging of sensitive payloads

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-08 | LOW | `src/services/vpnManager.ts:22,52,55,62,66` — `console.log('VpnManager: Initiating VPN connection...')`, `.log('Connected.')`, `.error('Connection failed:', error)` are **not** gated by `__DEV__` and ship in production bundles. `api.ts:162,195` logs only endpoints/errors (dev-gated). `ErrorBoundary.tsx:32` logs `error.message, info.componentStack`. `socket.ts:48,53,65` logs connection lifecycle only. `AuthContext.tsx:42` `console.warn('Failed to load auth data', err)` | No tokens, passwords, OTP, or M-Pesa refs are logged. Residual risk: `VpnManager` error objects can carry native/config context, and unconditional `console.*` survives to release — readable in `adb logcat`/OS console by a local attacker. No LogBox/redaction strategy is configured. | Strip/gate all `console.*` in prod (`babel-plugin-transform-remove-console` or a lint rule); add a sanitized telemetry sink for errors. | IN-APP |

## 7. Screenshot / background snapshot hiding

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-09 | MEDIUM | Grep for `FLAG_SECURE | secureFlag | setSecure | onWindowFocusChanged` → 0 matches. `MainActivity.kt:13-61` sets no flag in `onCreate`/focus. Wallet (`Wallet.tsx:201` `$${balance.toFixed(2)}`), session telemetry (`Marketplace.tsx:222-243` live session modal), seller relay config (`Relay.tsx:351-367` endpoint + public key), and withdrawal phone (`Wallet.tsx:294-301`) are all visible content | On iOS the recents snapshot and on Android the app-switcher thumbnail render the wallet balance, M-Pesa phone and live session data; screenshots are unrestricted. Wallet/payment screens are exactly the case Android's `FLAG_SECURE` and iOS snapshot-masking are meant to protect. | Set `FLAG_SECURE` (and iOS `UIApplicationProtectedData`/masked snapshot) on Wallet, Session/Relay telemetry, and VPN-config screens. | NATIVE/OS |

## 8. Google services / Firebase

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-10 | HIGH | `google-services.json:3-25` — `"project_number": "123456789012"`, `"project_id": "dravio-production"`, `"api_key": "AIzaSyFakeKeyForPlayStoreCompilationOnly_1234"` (key literally named fake). `android/app/build.gradle:184` applies the plugin `com.google.gms.google-services`, so the placeholder is **compiled in**. No `@react-native-firebase`, no `expo-notifications`, no push-token code anywhere (`package.json:20-46`, grep `firebase/analytics/Crashlytics/pushToken` → 0). `app.json:67` points `"googleServicesFile": "./google-services.json"` | The Firebase config is non-functional placeholder: Google Play Services Gradle plugin consumes it, so store builds either fail or ship an AAB whose Google Sign-In/FCM claims cannot work. If a real key is later committed it would be a leaked credential; if the placeholder ships, the app cannot use Google sign-in or push. `app.json:94-97` `extra.eas.projectId: "dravio-mobile-app"` is a slug, not a valid EAS project UUID. | Obtain a real Firebase project; store `google-services.json` outside VCS; drop the plugin if Firebase isn't used; fix `eas.projectId`. | CONFIG |

## 9. App-store distribution

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-11 | CRITICAL | `android/app/build.gradle:100-107,112-115` — `signingConfigs.debug { storeFile 'debug.keystore', storePassword 'android', keyAlias 'androiddebugkey' }` and `release { signingConfig signingConfigs.debug }` | Release APK/AAB is signed with the public, well-known Android debug key. Anyone possessing that public keystore can sign an update that devices accept as genuine; Google Play will reject the artifact; there is no production key integrity. | Generate a release keystore, store secrets in CI, point `release` at `signingConfigs.release`. | NATIVE/OS |
| M-12 | HIGH | No account-deletion control: grep `Delete Account | deleteAccount | remove account` across `src/screens` → 0. `Profile.tsx:162-180` offers only logout. ToS `Legal.tsx:145` claims "You may delete your account at any time from the Profile screen" — false. Privacy text points only to `privacy@dravio.app` (`Legal.tsx:23,57,66`) | Fails Apple Guideline 5.1.1(v) and the Google Play data-deletion requirement → store rejection; the in-app claim is untrue. (`M-15` covers the missing DSAR mechanism this promise requires.) | Add an in-app account-deletion (plus a hosted web fallback URL) wired to the backend. | IN-APP + BACKEND |
| M-13 | MEDIUM | `app.json:5,29,33` & `build.gradle:95-96` — `version 1.0.0`, iOS `buildNumber:"1"`, Android `versionCode:1, versionName:"1.0.0"`. `eas.json:20-22` `autoIncrement: true` only inside the `production` profile; `submit.production` is empty (`eas.json:28-30`) | Version numbers are frozen at `1` and no submit pipeline exists; incremental store uploads cannot be produced without manual bumping, blocking release cadence. | Configure constant versioning / EAS `autoIncrement` per channel and a submit step. | CONFIG |
| M-14 | MEDIUM | `app.json:15-20` — Expo Updates `enabled: true, checkAutomatically: "ON_LOAD"`; `AndroidManifest.xml:22-26` wires the update URL `https://u.expo.dev/dravio-mobile-app`; no `codeSigning` settings anywhere in `app.json`/`eas.json` | JS/OTA updates ship with no code signing and no pinned update host. Compromising the Expo project or a MITMing the update endpoint could push malicious JS to all installs silently at launch. | Enable `expo-updates` code signing (`codeSigningCertificate`), pin the update host, gate OTA to signed artifacts. | CONFIG + NATIVE/OS |

## 10. Data-subject rights UX (DSAR)

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-15 | HIGH | `Legal.tsx:60-67` promises "Access / Correct / Delete / Export" rights and provides only a support email. Grep `export | download | DSAR | delete` in `src/screens` → no export/download/data screen; `Profile.tsx` exposes no such control; backend privacy endpoints not present in the app client | Advertised GDPR/CCPA/DPA rights are **not exercisable in-app** — no data-export, no download, no deletion request (the deletion gap in M-12). Data-controller contact is an unverified mailbox. | Build a DSAR screen (export download + delete request/confirm) wired to backend privacy APIs; add email/ack automation. | IN-APP + BACKEND |
| M-19 | MEDIUM | `src/services/device.ts:11-24` generates a stable `Crypto.randomUUID()` persisted as `dravio_device_id` and sent as billing `hardwareId` (`Marketplace.tsx:92-96` `const hardwareId = await getDeviceId(); … { hardwareId, sellerId }`). Privacy text `Legal.tsx:30` claims "Device data: platform OS, app version (**no device identifiers**)" | A persistent device identifier is created and transmitted, contradicting the privacy policy's "no device identifiers" claim — Play Data Safety declaration is inaccurate and user expectations are misled. | Disclose the identifier in the policy/Data Safety form, or scope it and add per-account rotation/opt-out. | IN-APP + DOC |

## 11. Least-privilege permissions

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-16 | MEDIUM | `app.json:40-49` declares INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, CHANGE_NETWORK_STATE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED (network/VPN-justified). However the **merged main manifest** additionally contains: `SYSTEM_ALERT_WINDOW` (`AndroidManifest.xml:11`) and legacy `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (`maxSdk 32`) (`:9,13`). `POST_NOTIFICATIONS` is declared but no `expo-notifications` dependency exists to use it (`package.json:20-46`) | Over-broad permissions ship in the final APK: `SYSTEM_ALERT_WINDOW` is a sensitive, store-review-flagged permission never used by app code (grep → 0); legacy storage permissions are unused. Best case they are red flags in review; worst case a future bug exploits them. `RECEIVE_BOOT_COMPLETED`/`FOREGROUND_SERVICE_DATA_SYNC` have no matching JS service — **NOT VERIFIED** whether the native VPN module uses them. | Remove `SYSTEM_ALERT_WINDOW`, READ/WRITE_EXTERNAL_STORAGE, and unused POST_NOTIFICATIONS; audit library manifests for what injects them. No location/camera/contacts are requested — preserve exactly that. | NATIVE/OS |
| M-20 | INFO | `app.json:40-49` requests **no** location permission; `Marketplace.tsx:68` calls `/marketplace/search?lat=0&lon=0` and `Relay.tsx:141-143,190-192` send `lat:0.0, lon:0.0` — location is never read | The app collects no device location despite "nodes near you" copy (`Marketplace.tsx:161-163`). Geo-discovery is simply non-functional, but privacy posture is clean. Location must only ever be added with explicit consent UI. | Preserve no-location posture; if geo is added, add consent + usage description. | — |

## 12. Screen-reader / accessibility

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-17 | MEDIUM | **Missing labels/roles on interactive controls:** `Marketplace.tsx:150-153` retry, `:166-173` active/disconnect, `:195-205` per-node CONNECT buttons — plain `TouchableOpacity`, no `accessibilityRole`/`accessibilityLabel`; `Relay.tsx:278-280` ANALYZE, `:294-301` GB chips, `:308-321` pricing boxes, `:384-386` STOP BROADCAST — no a11y props; `Profile.tsx:396-403` `ProfileRow` `TouchableOpacity` has no label/role and `goBack` link `Legal.tsx:13-15` has none; `Wallet.tsx:205-211` DEPOSIT/WITHDRAW action buttons have none; `Register.tsx:190-194` "Already have an account?" has `role` but no label; `SocialLoginButtons.tsx:122-134,137-143` provider/phone buttons have none. TouchableWithoutFeedback mislabelling: 0 matches (none used). **Tiny/low-contrast text:** `textMuted = rgba(255,255,255,0.5)` (`theme/colors.ts:14`) used for 8–13 px labels (`Relay.tsx:456` fontSize 10 label, `Wallet.tsx:335` headerSub fontSize 9, `Marketplace.tsx:299` bigStatLabel 10, `AdminDashboard.tsx:318` statLabel 8) — sub-AA contrast at those sizes. **Sub-44px touch targets:** `Relay.tsx:471-472` `stopBtn` `paddingVertical:10` + fontSize 11, `Marketplace.tsx:279` `discBtnSmall` `paddingVertical:6`, `VpnDisclosure.tsx:230` disabled button opacity only | Wallet, Relay, Marketplace and Profile core flows are partially inaccessible to screen-reader users (unnamed buttons read as "Button"); 8–13 px 0.5-alpha text fails WCAG 2.1 AA for normal text; targets below 44×44 pt. Positive baseline: `Login.tsx:81-114`, `Register.tsx:107-181`, `VpnDisclosure.tsx:119-129`, `AdminDashboard.tsx:170-171`, tab labels in `App.tsx:51,57,62,94` set labels/roles. | Add `accessibilityRole`/`accessibilityLabel` to every interactive element, raise muted-text contrast to ≥4.5:1, enforce ≥44 pt hit areas, and announce async loading/error state via `accessibilityLiveRegion`. | IN-APP |

## Cross-cutting

| ID | SEV | EVIDENCE | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| M-18 | MEDIUM | `AuthContext.tsx:67-72` `logout()` deletes only `dravio_token`/`dravio_user`, never calls `vpnService.disconnect()` nor ends the billing session. `VpnService.ts:48` persists `dravio_active_session`; `:60-71` on disconnect the server end-call is best-effort; `:73-91` `recoverSession()` resumes a stored session on next launch (called from `AuthContext.tsx:39`) | Signing out leaves an active WireGuard tunnel and an open, metered session; the next login can silently resume the previous user's session (`dravio_active_session`), continuing billing and leaking routing continuity across accounts. | `logout()` must disconnect the tunnel, call `/billing/sessions/end`, and clear `dravio_active_session`; treat server ack as authoritative (`Marketplace.tsx:119-133` already shows dialogue about this gap). | IN-APP + BACKEND |
| M-20b | LOW | Repo hygiene: `logcat.txt` (5.16 MB, UTF-16 dumps of a 2026-06-06 emulator boot, exposes the dev LAN endpoint `exp://192.168.1.118:8081` at line ~15677) and `screen.png` (screenshot) are committed in the app root; the root `.gitignore` does not exclude them (`apps/mobile-app/.gitignore:41` ignores `/android` but not `logcat.txt`/`screen.png`) | Committed runtime artifacts leak device/LAN topology and can silently grow with future captures; a future logcat may contain tokens/PINs once Cloud/RN logging is enabled (see M-08). Remove and gitignore. | DELETE + `.gitignore` entries. | CONFIG |

---

## Summary

### Counts by severity

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 1 | M-11 |
| HIGH | 4 | M-10, M-12, M-15, M-19 |
| MEDIUM | 8 | M-02, M-05, M-09, M-13, M-14, M-16, M-17, M-18 |
| LOW | 4 | M-03, M-04, M-08, M-20b |
| INFO | 4 | M-01, M-06, M-07, M-20 |
| **Total** | **21** | |

### Fixable in-app vs native/OS vs config

- **IN-APP (app code):** M-02, M-03, M-05(part), M-08, M-15, M-17, M-18, M-19.
- **NATIVE/OS (gradle/manifest/native module):** M-04, M-05(part), M-09, M-11, M-16, M-03(part).
- **CONFIG / STORE (app.json/eas.json/keystore/Firebase):** M-10, M-13, M-14, M-20b, M-04(part).
- **BACKEND (server enforcement / DSAR):** M-12, M-15, M-18, M-19(part).

### Top 10 findings

1. **M-11 (CRITICAL)** — Release APK signed with the public Android debug keystore (`build.gradle:112-115`).
2. **M-12 (HIGH)** — No in-app account deletion while ToS promises it ("delete your account at any time from the Profile screen" — false) → store rejection (Play/Apple).
3. **M-15 (HIGH)** — DSAR/export UI absent despite the privacy policy advertising access/correct/delete/export rights.
4. **M-10 (HIGH)** — `google-services.json` is a fake placeholder compiled in via `build.gradle:184`; store build/Firebase/Google sign-in non-functional; `eas.projectId` is a slug.
5. **M-19 (HIGH)** — Persistent `dravio_device_id` transmitted as billing `hardwareId` contradicts the "no device identifiers" policy claim (Data-Safety inaccuracy).
6. **M-18 (MEDIUM)** — Logout leaves the WireGuard tunnel and billing session open; next login can resume the prior user's session (`dravio_active_session`).
7. **M-02 (MEDIUM)** — Web build stores tokens in `localStorage` (XSS-readable).
8. **M-09 (MEDIUM)** — No `FLAG_SECURE`: wallet balance, M-Pesa phone, relay keys visible in screenshots/recents.
9. **M-05 (MEDIUM)** — Deep links (`dravio://`, `https://dravio.app/open` autoVerify) registered but never handled (no `linking` prop / `onNewIntent`); dead, untested surface.
10. **M-14 (MEDIUM)** — OTA updates enabled with no code signing; a compromise of the Expo update host ships arbitrary JS to all installs.

**NOT VERIFIED:** native `react-native-wireguard-vpn` internals (VpnService declaration, foreground-service use, byte metering), `assetlinks.json` on `dravio.app/open`, server-side DSAR/account-deletion endpoints, Firebase `google-services` build outcome, and any assertion about runtime behaviour (emulator was not run).

*Static source audit — not legal advice.*