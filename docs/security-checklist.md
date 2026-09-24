# DRAVIO Security Checklist

Pre-deployment and recurring operator checklist. Each item maps to an audit
finding where applicable (see `production-audit.md`).

## Backend (before every release)

- [ ] `npm run build` passes with zero TypeScript errors.
- [ ] `npm test` passes (RBAC / OTP / money-math suites).
- [ ] `JWT_SECRET` >= 32 bytes, random, unique per environment. (A5)
- [ ] `JWT_ACCESS_TTL` (900s) and `JWT_REFRESH_TTL` (2592000s) set. (A5)
- [ ] `PLATFORM_FEE_PCT=0.20` — single source of truth. (A25)
- [ ] Stripe live keys + `STRIPE_WEBHOOK_SECRET` configured. (A6)
- [ ] M-Pesa live keys + `MPESA_CALLBACK_URL` reachable over HTTPS. (A7)
- [ ] `DATABASE_URL`, `REDIS_URL` (rediss), `KAFKA_URL` (optional) configured.
- [ ] Run `backend/migrations/001_hardening.sql`; note `payments.transactions
      session_id` is now nullable and `billing.ledger_entries` exists.
- [ ] No secrets in git: `git grep -IE "sk_live_|MPESA_CONSUMER|BEGIN.*PRIVATE KEY"`.
- [ ] `package-lock.json` committed so `npm ci` is reproducible. (A31)

## Frontends

- [ ] buyer-web/admin-portal `next build` passes.
- [ ] `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET` set to real values in
      Vercel (build-time defaults are insecure placeholders).
- [ ] `CORS_ORIGINS` lists the exact deployed origins (not `*`).
- [ ] No `127.0.0.1`/localhost endpoints in production bundles. (A22)

## Mobile (EAS build pipeline)

- [ ] `expo-doctor` clean.
- [ ] `eas update` channel `production` reachable; `expo-updates` version matches
      SDK 55 (`~55.0.22`). (A24)
- [ ] Production build has `usesCleartextTraffic: false`. (A27)
- [ ] `EXPO_PUBLIC_API_URL=https://api.dravio.app/v1` set for production.
- [ ] Real `google-services.json` supplied by CI secret / gitignored. (A28)

## Operators (ongoing)

- [ ] Ratelimit alerts: watch `/v1/auth/login`, `/v1/auth/otp/*` spikes.
- [ ] Audit `billing.ledger_entries` for unbalanced money movement; reconcile sum
      against `payments.transactions` COMPLETED amounts.
- [ ] Review `admin` action log (`audit.audit_log`) weekly.
- [ ] Rotate `JWT_SECRET` and provider keys on any suspected leak.
- [ ] Monitor Stripe `payment_intent.succeeded` volume vs. COMPLETED
      transactions — any mismatch indicates a replay/billing bug.
- [ ] Monitor M-Pesa `AMOUNT_MISMATCH` failures — signals callback forgery
      attempts or FX drift.

## Pen-test bores (quarterly)

1. Register with `role=ADMIN` -> rejected.
2. Hit `/admin/telemetry` unauthenticated -> 401. (A1)
3. POST `/v1/billing/topup` -> 409 (no wallet credit). (A8)
4. Unauthenticated `/v1/internal/analyze/payment` -> 401. (A29)
5. Start a session with a tampered `pricePerMb` -> server price used. (A16)
6. Replay an M-Pesa callback / Stripe webhook -> no second credit. (A13)
7. Read another user's payment by id -> 404. (A14)