# DRAVIO Mobile Security Audit

Date: 2026-09-20. App: `apps/mobile-app` (Expo SDK 55, React Native 0.83).

## Findings fixed this pass (A24, A27, A28 partial)

- **OTA updates** (A24): added `expo-updates` (`~55.0.22`), `updates.url`
  (`https://u.expo.dev/dravio-mobile-app`), `runtimeVersion` policy
  `fingerprint`, EAS `production` channel, and `eas.json`. Apps can now ship
  remote updates without a store release.
- **Cleartext traffic** (A27): `usesCleartextTraffic` set to `false` for
  production Android builds, so the app refuses plain-HTTP API connections in
  production (mitigates T21-style endpoint tampering / on-path data theft).
- **Credentials hygiene** (A10/A28): `google-services.json` is a placeholder
  (`AIzaSyFake...`); real files must come from CI secrets and are gitignored.

## Secrets / config

- API base URL resolved from `EXPO_PUBLIC_API_URL` (EAS build env) with localhost
  fallbacks confined to development mode (`src/services/api.ts`). WebSocket URL
  uses `EXPO_PUBLIC_WS_URL` (`src/services/socket.ts`).
- Tokens stored via `expo-secure-store` (Keychain / Keystore) — no plaintext
  token persistence in AsyncStorage.
- `eas.json` production env points at `https://api.dravio.app/v1`.

## Auth/network flows audited

- Login/register/OAuth delegates to backend `/v1/auth/*`; access token attached
  as `Authorization: Bearer` (see `lib/api.ts` flow of buyer-web for the
  canonical client contract: `access_token`, `expires_in`).
- Session start uses `POST /v1/billing/sessions/start` `{ hardwareId, sellerId }`
  — price is intentionally NOT accepted from the client (see
  `session-manager.ts`).
- Usage metering `POST /v1/billing/usage` is idempotent and delta-based server-side.

## What remains

- Remove dev stubs (`src/mocks/wireguard-mock.js`, TunnelMonitor placeholders)
  before store release; wire to the real WireGuard SDK (`react-native-wireguard-vpn`).
- Provision real Push Notifications via EAS and replace `POST_NOTIFICATIONS`
  consent UX accordingly.
- Configure store signing/upload secrets (`play-store-key.json`,
  Apple App Store) in CI; never commit them.
- `eas update` channel `production` requires a real EAS project id (currently
  `dravio-mobile-app`).