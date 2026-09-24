# DRAVIO Threat Model

Date: 2026-09-20. Status: hardened baseline. See `production-audit.md` for the
full finding log and `security-architecture.md` for the design.

## Assets

- Buyer/seller wallets and transaction ledger (money movement).
- Auth sessions/refresh tokens; KYC + PII (email, phone, name, country).
- Seller marketplace listings and session telemetry.
- Admin control plane (lockdown, kill-switches, rules).
- Provider credentials (Stripe, M-Pesa, Twilio, Firebase, Cloudinary, DB, Redis).

## Actors

| Actor | Trust | Typical attack |
|---|---|---|
| Anonymous internet | none | Scan, forge webhooks, mass-register, IDOR |
| Buyer | own wallet only | Price tampering, double-spend, refund abuse, priv-esc to admin |
| Seller | own listing only | Earning inflation, fake listings |
| Admin operator | authenticated, role-scoped | Account-compromise pivot |
| Providers (Stripe/M-Pesa) | signature/reconciliation verified | Injection of crafted callbacks (attacker, not provider) |
| Compromised subcomponent (Redis/DB/Kafka) | assumed not reachable from internet | Data exfil — prevent via infra network isolation |

## Threat matrix (resolved)

| ID | Threat | Vector | Mitigation | Finding |
|---|---|---|---|---|
| T1 | Full admin takeover | Unauthenticated RBAC fabrication | `jwtVerify()` before role check; no fake identities | A1 |
| T2 | Privilege escalation | `role=ADMIN` in register/OAuth | enum restricted to BUYER/SELLER; server-provisioned roles | A2 |
| T3 | OTP bypass | universal code `123456` | random 6-digit only in test env; Twilio required in prod; rate limits | A3 |
| T4 | Auth bypass / permanent sessions | no-expiry JWTs | `exp` on access tokens; hashed refresh tokens + rotation + revoke | A5 |
| T5 | Free service | forged Stripe webhook / spoofed provider_ref | raw-body signature verify; complete only verified PaymentIntent | A6 |
| T6 | Free service | forged M-Pesa callback | amount reconciliation + PENDING guard; 500 on processing errors | A7 |
| T7 | Money printer | `/v1/billing/topup` client credit | route removed; credit only inside verified completion tx | A8 |
| T8 | Wallet drain | unauth `/v1/payments/wallet/deduct` | auth + token-derived userId | A9 |
| T9 | Profile tampering | SQLi via dynamic `SET` / mass assignment / user-creation backdoor | whitelisted columns, Strict zod schema, register-only profile creation | A4,A11,A12 |
| T10 | Double-spend / replay | unconditional status flips, duplicate events | `WHERE status='PENDING'` guards; event only on real transition | A13 |
| T11 | Cross-user data access | payment status IDOR | `findOwnedById(id, userId)` | A14 |
| T12 | Price manipulation | client-set pricePerMb / arbitrary sellerId | server-side price from listing; sellerId validated | A16 |
| T13 | Double-billing / lost fees | non-transactional deduct+credit; no usage idempotency | single DB tx; delta-based committed-bytes; cent carry-over | A17,A25 |
| T14 | Session hijack | unauth session create; arbitrary buyer_id | auth; buyer from token; seller validated | A18 |
| T15 | Marketplace data leak / DoS | full-scan seller lookup from (0,0) | direct redis `hgetall(seller:<id>)`; capped listing | A19 |
| T16 | Info disclosure | global active-session listing | admin-only | A18 |
| T17 | Internal API abuse | unauth `/v1/internal/*` | `authorize(['ADMIN','SUPER_ADMIN'])` | A29 |
| T18 | Credential leak | hardcoded M-Pesa creds in git | env-only creds; no defaults | A10 |
| T19 | Stale binaries | duplicate compiled page.js shadows page.tsx | deleted; source of truth is TSX | A20 |
| T20 | Broken auth flows | `dynamicParams=false` w/o staticParams -> 404 | removed | A21 |
| T21 | Auth bypass (client-side) | hardcoded localhost admin gateway | env-based API client everywhere | A22 |
| T22 | Unprotected pages | middleware matcher never matched | fixed matcher; server-side session check | A23 |
| T23 | Stale mobile builds | no OTA pipeline | expo-updates + EAS channels | A24 |

## Residual risks (accepted, documented)

- **Fraud engine** (`/v1/internal/analyze/*`) remains rule-based and
  admin-gated; no live payment fraud OTP blocking yet — future work.
- **Payouts** are recorded as `PENDING` jobs; provider payout execution is not
  yet automated (requires bank/pay-out provider onboarding).
- **Per-MB pricing=model `per_hour`** sellers cannot be billed per-byte; the
  server rejects those sessions (503) instead of guessing.
- **Redis loss** for an active session drops the committed-byte counter; billing
  fails safe (no charge), not fail-open to free money.
- **DB `ssl.rejectUnauthorized`** is configurable; production should point it at
  a real CA (`DATABASE_SSL_CA=1`).

## Privilege model (enforcement ladder)

1. `fastify.authenticate` — every user-scoped route.
2. `fastify.authorize([...])` — role-gated internals.
3. `requireRoles([...])` — admin surface (token `roles` only).
4. Ownership predicates in SQL (`user_id = $token_sub`) — IDOR prevention.
5. State-machine guards + idempotency keys — money-movement safety.
6. Provider signature/reconciliation — external-value integrity.