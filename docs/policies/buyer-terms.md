# DRAVIO Terms of Service and Marketplace Buyer Terms

This file hosts two policy versions from the DRAVIO policy registry. Both are served from this path:

- **Terms of Service** (`terms`, v1.0) — accepted at registration.
- **Marketplace Buyer Terms** (`buyer_terms`, v1.0) — accepted before purchase.

---

# Part A — Terms of Service

<!-- BEGIN POLICY HEADER -->
- **policy_id:** `terms`
- **name:** Terms of Service
- **version:** `1.0`
- **effective_at:** `2026-09-01T00:00:00.000Z`
- **required_gates:** `REGISTER`
- **doc_path:** `/docs/policies/buyer-terms.md`
<!-- END POLICY HEADER -->

### A.1 Acceptance

By creating a DRAVIO account you agree to these Terms of Service, the Acceptable Use Policy (`aup`), and the Privacy Policy (`privacy`). If you do not agree, do not create an account.

### A.2 Accounts and roles

DRAVIO accounts are created by you with a self-selected role: `BUYER`, `SELLER`, or both, chosen at registration. Accounts are provisioned in the backend; privileged roles such as billing administrator are not assignable through public account APIs. Our profile data model includes a KYC level field that is currently unused for any flow on the platform.

### A.3 Eligibility and children

DRAVIO does not knowingly serve or market the marketplace to children. We do not collect age data and cannot verify your age; by creating an account you confirm you are not providing age-restricted content through the platform, which is prohibited regardless of your age.

### A.4 The marketplace service

DRAVIO operates a marketplace that routes buyers to sellers for shared internet access. Buyers pre-fund a wallet; sessions route traffic through a seller's relay; usage is billed per gigabyte from the wallet.

### A.5 Your data

Personal data handling is described in the Privacy Policy (policy id `privacy`). You may exercise data-subject rights — `ACCESS`, `CORRECTION`, `OBJECTION`, `DELETION`, `PORTABILITY` — through the app or the API.

### A.6 Account termination

We may suspend or terminate accounts that violate these terms or the Acceptable Use Policy, as our right but not our obligation. You may delete your account at any time.

---

# Part B — Marketplace Buyer Terms

<!-- BEGIN POLICY HEADER -->
- **policy_id:** `buyer_terms`
- **name:** Marketplace Buyer Terms
- **version:** `1.0`
- **effective_at:** `2026-09-01T00:00:00.000Z`
- **required_gates:** `PURCHASE`
- **doc_path:** `/docs/policies/buyer-terms.md`
<!-- END POLICY HEADER -->

### B.1 What you must accept

These Marketplace Buyer Terms apply to purchases made through the marketplace. Acceptance of the current version of these terms is required before you can initiate a payment or purchase. If the current version has not been accepted, the platform refuses the purchase.

### B.2 Pricing transparency

Before you purchase, you can obtain an exact price breakdown from the pricing transparency endpoint (`GET /v1/compliance/fee-disclosure`). The breakdown states:

- the package price in USD cents,
- what you (the buyer) pay — exactly the package price,
- the platform fee, which is borne by the seller, and
- what the seller receives after the fee.

Buyer-paid and seller-received amounts therefore differ by the platform fee. Fees and amounts are computed in exact integer-cent arithmetic; there are no hidden or fabricated fractions. The default platform fee is 20 percent of the package price and is borne by the seller, so it never increases the price you pay.

### B.3 Funding and billing

- You pre-fund a DRAVIO wallet.
- Card top-ups use an external hosted checkout operated by Stripe; card details never reach DRAVIO. M-Pesa STK push is also supported.
- Sessions are billed per gigabyte from your wallet using the price published by the seller. The price charged is the server-authoritative price from the seller's listing; a session cannot be opened without one, and a minimum balance is required.
- Billing math is exact to the cent; fractional-cent amounts are carried forward rather than inflated.

### B.4 Connection expectations

Connection quality depends on the seller's network. DRAVIO publishes measured speed and stability where the seller reports them and does not fabricate quality metrics; sellers whose listings lack a real price are not offered at checkout.

### B.5 Disputes and refunds

- You may open a dispute on your own transaction, provided the transaction is in a paid or fulfilled state and you are its owner. A reason is required.
- Opening a dispute moves the transaction into a disputed state and stops further normal progression.
- Moving money (full refund, partial refund, or reversal) is performed only by a billing administrator, never automatically and never by the buyer. Refunds are discretionary, reason-based decisions and are audited.
- Refund timelines are not set: DRAVIO does not promise a number of days for review, decision, or money movement. Where a refund is approved, the exact credited amount depends on the transaction state and is set by the administrator.

### B.6 Money movement review

Any money movement on a transaction (refund, partial refund, reversal, or cancellation) is reviewed and recorded by a billing administrator, and a reason is required for every such action. The event history of a transaction is visible in the platform.

### B.7 Your responsibilities

- Use purchased bandwidth lawfully and in line with the Acceptable Use Policy.
- Pay from your funded wallet; sessions stop when the wallet can no longer cover the minimum.
- Keep your account credentials secure.

### B.8 Acceptable use

The Acceptable Use Policy (`aup`) applies to all use of purchased bandwidth, including prohibitions on unlawful content, abuse of sellers' connections, harvesting of personal data, credential stuffing, and interference with a seller's service.

---

## Technical implementation notes (internal)

| Obligation | Mechanism |
| --- | --- |
| `terms` accepted at registration | `terms` is in the `REGISTER` gate's required policies; `POLICY_CATALOG` in `backend/src/modules/compliance/pure/policy-registry.ts`. Acceptance via `POST /v1/compliance/acceptance`. |
| `buyer_terms` enforced on purchase | `PaymentService.initiatePayment` checks `assertSatisfiesGate('PURCHASE', ...)` and throws `POLICY_ACCEPTANCE_REQUIRED` (`backend/src/modules/payment/services/payment.service.ts:13-21`); surfaced as HTTP 403 by `backend/src/modules/payment/index.ts:21-22`. |
| Pricing transparency | `GET /v1/compliance/fee-disclosure` → `quoteForAmount` / `feeStatementLines` in `backend/src/modules/compliance/pure/fee-disclosure.ts`, built on `computeFees` in `backend/src/modules/payment/money.ts` (default `PLATFORM_FEE_PCT = 0.20`, sanitized to 0–0.5). |
| Buyers pay package price; fee seller-borne | `totalChargedToBuyerUsd = packagePriceUsd`; `feeBearer: 'SELLER'` in `fee-disclosure.ts`. |
| Server-authoritative price + minimum balance | `validateSessionStart` in `backend/src/modules/billing/core/session-gate.ts` (`SELLER_PRICE_UNAVAILABLE`, `INSUFFICIENT_FUNDS`, `MIN_SESSION_BALANCE_USD = 0.5`). |
| Exact-cent metering | `settleCentCarry` (fractional-cent carry), `money.ts:55`. |
| Buyer-owned dispute | `POST /v1/payments/:id/dispute` (`backend/src/modules/payment/index.ts:148`), validated by `TRANSITION_RULES` in `backend/src/modules/payment/core/transaction-machine.ts` (DISPUTED from PAID/FULFILLED, `requiresOwner`, `reasonRequired`). |
| Money movement by BILLING_ADMIN only | `POST /v1/payments/:id/status` (`REFUND`/`PARTIAL_REFUND`/`REVERSE`/`CANCEL`) guarded by `fastify.authorize(['BILLING_ADMIN','ADMIN'])`; transitions require `reasonRequired` and are CAS-guarded and audited (`transaction.service` history at `POST /v1/payments/:id/history`). |
| Payment initiation methods | Stripe hosted checkout (card data never on DRAVIO) via `stripeProvider.createPaymentIntent` in `backend/src/modules/payment/providers/stripe.provider.ts`; M-Pesa callback handling in `payment.service.handleMpesaCallback`. |

## Known gaps

- There is no buyer-facing dispute or refunds user interface in every app yet; the dispute and refund capabilities exist at the API level and in the admin surface, but buyer web/mobile self-service dispute entry is not complete in all apps.
- No refund or dispute SLA is set or promised; timeframes remain `TBD` pending operations policy and counsel review.
- `terms`/`buyer_terms` acceptance currently flows through `POST /v1/compliance/acceptance`; not all apps render these documents with a real acceptance submission UI at registration/purchase time.
- The platform does not itself fabricate quality or price metrics (listings without a real price are excluded from checkout), but it also does not independently verify seller-published speed or stability values.

---

> This document is DRAVIO's internal policy text. It is not legal advice and does not claim statutory compliance. Applicability of specific laws requires qualified counsel.