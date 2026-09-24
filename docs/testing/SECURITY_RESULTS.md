# SECURITY_RESULTS.md — DRAVIO security verification

Date: 2026-09-21.

## Verdict
The pure security controls that could be exercised are reached through the
unit layer and PASS. Live host-based checks (JWKS validation, live BOLA, rate
limiting) are BLOCKED — no API reachable, no `.env`/DB.

## PASS (executed, in `backend/tests/`)

### Session authorization (IDOR surface) — `session-state.test.ts`
`canAccessSession(session, callerId, roles)`:
- Owner (`buyer_id` match) → allowed.
- Other buyer without operator role → denied (403 path; no cross-session action).
- `BUYER` role still denied; only `ADMIN` and `SUPER_ADMIN` (any subset) allow mediation.
- `isAdminUser` accepts exactly the two operator roles, rejects undefined/mixed.

This backs `handoff`/`end` session endpoints, which call the seam instead of a
hand-rolled inline check (same semantics, single tested source of truth).

### VPN configuration — fail closed — `session-state.test.ts`
- Missing relay endpoint OR missing relay public key → throws
  `SELLER_RELAY_NOT_REGISTERED`, `statusCode 409` (no tunnel silently built
  with invented relay).
- Valid relay → config contains ONLY the seller's real endpoint + key; client
  private key is a sentinel substituted on-device; DNS 1.1.1.1; AllowedIPs 0.0.0.0/0.

### Session-open gate — server-enforced — `session-state.test.ts`
Order enforced: seller → hardware id → server-resolved price (>0; client can
never set price) → wallet balance >= `MIN_SESSION_BALANCE_USD` (0.50) vs 0.49 → reject / 0.50 → OK.

### Device fingerprinting / risk scoring — `auth-security.test.ts`
- Deterministic for identical header set; changes when UA changes.
- Tolerates missing/undefined headers (hardened `headers = {}` default).
- Risk score hits the reprisal IP (100); benign IPs/empty → 0.

### Billing integrity (money-safe abuse surface) — `billing-decision.test.ts`
- Reported-usage replay/regression is never billable (delta <= 0 → no move).
- Sub-cent charges can never be lost and only settle as whole cents; carry
  stays in [0, 0.01) across 500 reports; each settlement is cent-exact.
- Seller/platform fee split never creates or loses money (sum == billed cost).

## BLOCKED (needs live infra, will be executed when provisioned)
- JWKS verification of incoming JWT against `apps/*`-registered keys.
- Live BOLA: attempt to handoff/end another user's session over the API and
  confirm 403; operator-role escalation checks end-to-end.
- Rate limits / OTP brute force / account-takeover via live endpoints.
- Payment gateway hardening (Stripe webhook signature, M-Pesa callback
  validation) — requires gateway test credentials + webhook tunnel.