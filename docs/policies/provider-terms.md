# DRAVIO Provider Terms of Sale

<!-- BEGIN POLICY HEADER -->
- **policy_id:** `provider_terms`
- **name:** Provider Terms of Sale
- **version:** `1.0`
- **effective_at:** `2026-09-01T00:00:00.000Z`
- **required_gates:** `SELL`
- **doc_path:** `/docs/policies/provider-terms.md`
<!-- END POLICY HEADER -->

## 1. Who these terms apply to

These Provider Terms of Sale apply when you sell shared internet access through the DRAVIO marketplace (as a "provider" or "seller"). They are an addition to the Terms of Service (`terms`), the Privacy Policy (`privacy`), and the Acceptable Use Policy (`aup`), all of which continue to bind you. Acceptance of the current version of these Provider Terms is part of the `SELL` gate, alongside the provider onboarding intake described below.

### 1.1 Compliance stance

These are DRAVIO's own commercial terms for sellers. They describe the platform's rules and obligations, and they do not assert that any particular law or regulator applies to you. In particular, the application of Kenya's consumer-protection (CA) rules to marketplace arrangements such as this one is currently unresolved, and nothing in these terms claims statutory compliance with them. Applicability of specific laws requires qualified counsel, both for the platform and for you as a reseller of connection bandwidth.

## 2. Becoming a provider

- You select the `SELLER` role yourself at registration or login; seller status is not assigned to you by the platform or by any public admin flow.
- You complete provider onboarding intake (`POST /v1/provider/intake`), declaring a provider type. Supported types are: `INDIVIDUAL`, `BUSINESS`, `ISP`, `HOTSPOT_OPERATOR`, `NETWORK_OPERATOR`, and `OTHER_AUTHORIZED_PROVIDER`.
- The verification fields required depend on your declared type and are configuration-driven. For example, business-style types (`BUSINESS`, `ISP`, `NETWORK_OPERATOR`) require a legal name and registration number plus an attached business record; an individual provider is not required to supply organization registration. Requirements are configuration set by DRAVIO, not a claim that any particular statute applies.
- After intake you publish a seller listing via heartbeat with a real price and relay details. Listings without a real positive price are excluded from the marketplace; the platform never fabricates a default price for you.

## 3. Provider obligations

### 3.1 Publish honest information

- Publish a real, positive price (`per_gb` by default) that you intend to honor. The price in your listing is the server-authoritative price used to open sessions; buyers cannot set their own price.
- Register an honest relay endpoint and a real WireGuard public key. Sessions fail closed when these are absent.
- Report measured speed and stability rather than placeholders; the platform discards placeholder values and never substitutes its own numbers.

### 3.2 Keep the hotspot operational while listed

Your listing is liveness-driven from your heartbeats. A listing that stops reporting ceases to be offered to buyers. While you are listed as active, you must keep the hotspot reachable and operational for the sessions routed to you, subject to the Acceptable Use Policy's abuse protections.

### 3.3 Do not charge buyers off-platform

You must not solicit, accept, or arrange payment from buyers outside the DRAVIO marketplace for bandwidth sold through the platform. All marketplace transactions must settle through the platform's wallet and payment systems.

### 3.4 Connection rights and law

- Only share connections you own or are authorized to share.
- Comply with your own internet service provider's terms and with applicable law, including the laws of Kenya.
- Do not route illegal content, abuse other connections, or interfere with other users' sessions. The Acceptable Use Policy (`aup`) applies in full to the bandwidth you sell.

### 3.5 Relay exposure is your responsibility

Your relay endpoint and WireGuard public key are exposed publicly in the marketplace listing endpoints so that buyers can configure sessions. This means your relay is reachable by any marketplace buyer: you are responsible for securing and operating the relay, and for using the platform's session controls to stop abusive sessions on your side.

## 4. Pricing and fees

- Buyers pay exactly the package price.
- The platform fee is borne by you, the seller, out of what the buyer pays. The default platform fee is 20 percent; the current configured percentage is available from the pricing transparency endpoint (`GET /v1/compliance/fee-disclosure`), which returns the exact split in cents for any amount.
- All money math is exact integer-cent arithmetic; there is no rounding against you beyond cents.

## 5. Earnings and payouts — what is and is not available today

- Earnings from fulfilled sessions accrue as earnings balances in your marketplace wallet (per-session earnings records are written with platform fee and net amounts).
- **Payouts are not yet functional.** When you submit a withdrawal request, the platform writes a payout request record in `PENDING` status. There is currently no implemented processing pipeline that transfers funds out to you — no scheduled payout run, no payout settlement, and no transfer of money to your account. Distribution of `PENDING` payout records to actual money movement is not implemented yet.
- Because payouts are not yet operational, DRAVIO does not promise any payout timeline or window. Do not rely on withdrawal for cash flow planning. Withdrawal availability will be communicated separately when processing is implemented.
- Note: a withdrawal request today debits the ledger balance at the time of the request even though the outbound transfer is not performed. This is a known limitation under review.

## 6. Disputes, reversals and your earnings

- A buyer may open a dispute on their own paid or fulfilled transaction with a stated reason. A disputed session's earnings are not treated as settled while the dispute is open.
- Money movement (full refund, partial refund, or reversal) is performed only by a billing administrator, never automatically and never by the buyer or seller. Every such action requires a reason and is audited; the transaction history is visible in the platform.
- Where a refund or reversal reduces or reverses seller earnings, the adjustment is recorded in the earnings and ledger records. Refund timelines are not promised; the review and decision process has no published SLA at this time (`TBD`).

## 7. Provider data and deletion

- Your intake submissions, contact/registration details, earnings records, and payout request records are personal data governed by the Privacy Policy (`privacy`).
- Financial records — earnings, payouts, ledger entries — are retained for accounting and are pseudonymized, not destroyed, when you exercise deletion: identity rows are removed and the financial records keep a broken personal linkage. The retention registry (`GET /v1/compliance/retention`) documents categories and durations.
- You may raise data-subject requests (`ACCESS`, `CORRECTION`, `OBJECTION`, `DELETION`, `PORTABILITY`) via `POST /v1/privacy/requests`; fulfillment requires the reviewer/DPO role that the platform operator must provision.

## 8. 'SELL' gate acceptance

Acceptance of these Provider Terms (and of the registration policies) is reported through the platform's acceptance-status endpoint (`GET /v1/compliance/acceptance/status`) as the `SELL` gate. The provider onboarding intake and the `SELLER` role are the concrete checkpoints today; the listing gate is still being wired end to end (see Known gaps).

## 9. Termination and enforcement

We may remove listings, suspend seller accounts, or terminate sessions that violate these terms or the AUP, as our right but not our obligation. Enforcement is discretionary and does not create a duty on DRAVIO to monitor your traffic or the traffic you route.

### 9.1 Stopping selling

To stop selling you may simply stop sending heartbeats: the listing expires on its own and is no longer offered to buyers. Sessions already in progress may continue until they end or are terminated; you can terminate abusive sessions from your side. Outstanding earnings balances remain recorded as described in section 5; account deletion is handled under the Privacy Policy and cannot destroy retained financial records.

---

## Technical implementation notes (internal)

| Obligation | Mechanism |
| --- | --- |
| `SELL` gate definition | `provider_terms` requires the `SELL` gate; `POLICY_CATALOG` in `backend/src/modules/compliance/pure/policy-registry.ts`. Acceptance via `POST /v1/compliance/acceptance`; status reported via `GET /v1/compliance/acceptance/status`. |
| Provider types + verification config | `PROVIDER_TYPE_CONFIG` / `validateIntake` in `backend/src/modules/compliance/pure/provider-intake.ts`; endpoint `POST /v1/provider/intake` (SELLER role required) in `backend/src/modules/provider/index.ts`; configured to reject unknown fields and require per-type fields plus `business_record_attached` for business records. |
| Heartbeat publishing, SELLER-role enforced | `POST /v1/marketplace/heartbeat` guarded by `fastify.authorize(['SELLER'])` in `backend/src/modules/marketplace/index.ts`. |
| Listings without a real price excluded | `marketplace.repository` filters on `price` finite and `> 0` and drops placeholder patterns (`marketplace.repository.ts:45-56, 104-118, 166-176`). |
| Relay endpoint + public key exposed publicly | Returned by `GET /v1/marketplace/sellers` and `/v1/marketplace/sellers/:id` (`relay_endpoint`, `relay_public_key` fields, `marketplace/index.ts:63-64`). Policy-relevant security consideration: the relay is fully reachable; provider responsible for securing it. |
| Heartbeat liveness | Redis hash with 300s expiry (`updateHeartbeat`, `marketplace.repository.ts:96`); absent heartbeats remove the listing. |
| Server-authoritative price | `getTrustedPricePerMb` (`marketplace.repository.ts:125`) + `validateSessionStart` (`backend/src/modules/billing/core/session-gate.ts`). |
| Fee split (seller-borne) | `quoteForAmount`/`feeStatementLines` in `backend/src/modules/compliance/pure/fee-disclosure.ts`; `computeFees` in `backend/src/modules/payment/money.ts` (default 20%, validated 0–0.5). |
| Earnings accrual | `billing.seller_earnings` rows (net + platform fee) in `master_init.sql:244`; earnings appear in the seller's access envelope (`privacyService.collectAccessEnvelope`). |
| Payout requests | `POST /v1/billing/withdraw` writes `payments.payouts` rows with `status = 'PENDING'` and debits the ledger balance (`backend/src/modules/billing/api/routes/wallet.routes.ts:60-84`). `stripeProvider.createPayout` exists (`stripe.provider.ts:60`) but is not wired to any pipeline. |
| Suspension / session termination | Admin commands dispatched to `dm.admin.command` (`backend/src/modules/admin/actions/action-dispatcher.ts`); endpoints `POST /v1/admin/session/:id/terminate`, `POST /v1/admin/users/:id/suspend`. |

## Known gaps

- The `SELL` gate is not yet enforced server-side as a hard block: a `SELLER`-role account can currently publish a heartbeat even without an accepted current `provider_terms` version. Enforcement-to-date covers role (`SELLER`) and intake submission only. A publish-time acceptance check must be added before this policy can truthfully claim the gate is enforced.
- Payouts are not functional (see section 5). The `POST /v1/billing/withdraw` route also returns a canned delivery-time message ("funds arrive within 1-3 business days") that asserts a timeline the platform does not implement or honor; that message should be removed or replaced with the honest payout-unavailable status.
- Provider intake records are stored and CAS-transitionable (SUBMITTED → APPROVED/REJECTED/WITHDRAWN), but approval of an intake submission is not yet a prerequisite that blocks listing publication end to end.
- There is no automated verification that a published relay endpoint is genuinely the seller's, that a connection is authorized for resale, or that a seller's ISP terms permit sharing; disclosure and self-obligations are relied upon.

---

> This document is DRAVIO's internal policy text. It is not legal advice and does not claim statutory compliance. Applicability of specific laws requires qualified counsel.