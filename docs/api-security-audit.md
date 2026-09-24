# DRAVIO API Security Audit

Result of hardening pass — endpoint-by-endpoint as of 2026-09-20.

## Public (no auth)

| Endpoint | Notes | Status |
|---|---|---|
| `GET /` , `GET /health` | Health. No data exposure. | OK |
| `POST /v1/auth/register` | `role` enum BUYER/SELLER only. | OK |
| `POST /v1/auth/login` | Rate-limited 5/min. | OK |
| `POST /v1/auth/oauth` | Provider-verified; role restricted. | OK |
| `POST /v1/auth/otp/send` | Rate-limited 3/min; Twilio required in prod. | OK |
| `POST /v1/auth/otp/verify` | Rate-limited 5/min; random code. | OK |
| `POST /v1/auth/refresh` | Refresh-token rotation or legacy Bearer re-sign. | OK |
| `GET /v1/marketplace/search` | Public browse. | OK |
| `GET /v1/marketplace/sellers` | Capped listing (100). | OK |
| `GET /v1/marketplace/sellers/:id` | Direct redis lookup. | OK |
| `POST /v1/payments/webhook` | **Raw-body** Stripe signature verification. | OK |
| `POST /v1/payments/mpesa/callback` | Amount reconciliation + PENDING guard. | OK |

## Authenticated (self-scoped)

| Endpoint | Notes | Status |
|---|---|---|
| `POST /v1/auth/logout` | Revokes refresh token / all user tokens. | OK |
| `GET /v1/users/me` / `PUT /v1/users/me` | Whitelisted fields only. | OK |
| `GET /v1/billing/balance` | Own balance. | OK |
| `POST /v1/billing/withdraw` | Seller-only, amount<=$25,000, atomic. | OK |
| `GET /v1/billing/invoices` , `transactions` , `sessions/*` | Own rows only (SQL where). | OK |
| `POST /v1/billing/sessions/start` | Server-side price; min balance 0.50. | OK |
| `POST /v1/billing/sessions/end` | Owner session. | OK |
| `POST /v1/billing/usage` | Delta billing; idempotent. | OK |
| `POST /v1/payments/initiate` | Validated amounts/currency/method/idempotency. | OK |
| `GET /v1/payments/:id/status` | `findOwnedById` — other users' ids -> 404. | OK |
| `POST /v1/payments/wallet/deduct` | Self-only, validated. | OK |
| `POST /v1/sessions` | Buyer from token. | OK |
| `POST /v1/sessions/:id/handoff|end` | Owner or admin. | OK |
| `POST /v1/marketplace/heartbeat` | Seller writes own listing. | OK |

## Admin / internal

| Endpoint | Notes | Status |
|---|---|---|
| `/admin/telemetry`, `/admin/incidents`, `/admin/lockdown` | RBAC-gated (token roles), JWT required. | OK |
| `/v1/admin/*` controllers | RBAC-gated. | OK |
| `/v1/internal/analyze/*` | `authorize(['ADMIN','SUPER_ADMIN'])`. | OK |
| `GET /v1/sessions/active` | Admin-only. | OK |

## Removed / neutralized

- `POST /v1/users` (profile-creation backdoor) - removed.
- `POST /v1/billing/topup` (free money) - rejected with 409.
- OTP universal code, fabricated admin identity - removed.

## Compliance notes

- Money movement is auditable via `billing.ledger_entries` + `payments.transactions`.
- Financial events emit `dm.payment.completed` only on real state transitions.
- Sensitive operations are rate-limited; refresh tokens are hashed at rest.