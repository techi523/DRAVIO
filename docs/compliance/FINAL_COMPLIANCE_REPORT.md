# DRAVIO — Final Compliance Engineering Report

**Phase 35 — Legal, Regulatory, Policy & Compliance Engineering**
**Date:** 2026-09 (engineering session)
**Scope:** What was inspected, what was actually built, what remains open.
This is a TECHNICAL report. It is NOT a legal opinion and does not assert
compliance with any statute. Legal determinations require qualified counsel and
regulatory agencies (ODPC / Communications Authority of Kenya / Central Bank of
Kenya as applicable).

Statuses used: `PASS / PARTIAL / FAIL / NOT APPLICABLE / UNKNOWN /
LEGAL REVIEW REQUIRED / BLOCKED`. A control is `PASS` only when implemented and
verifiable in this codebase — never inferred from intent or documents.

---

## 1. TECHNICAL COMPLIANCE STATUS (summary)

| Area | Status | Key evidence |
| --- | --- | --- |
| Data-subject rights (access/correction/objection/deletion/portability) | PASS — implemented | `POST /v1/privacy/requests`, reviewer workflow, real deletion (`privacy.service.ts`) |
| Versioned policy acceptance (current version only) | PASS — implemented | `compliance.policy_acceptances`, `POST /v1/compliance/acceptance`, `validateAcceptance()` |
| Purchase-time policy enforcement | PASS — implemented | `PaymentService.initiatePayment` → `403 POLICY_ACCEPTANCE_REQUIRED` |
| Transaction dispute/refund/cancel/reverse state machine | PASS — implemented | `transaction-machine.ts` (+11 legal transitions, terminal-state immutability) |
| Audited, CAS-guarded transaction transitions | PASS — implemented | `compliance.transaction_events` (same-DB-transaction append) |
| Audit event pipeline (producer → Kafka → `audit.audit_log`) | PASS — implemented | `audit/producer.ts`, `audit-events.ts`, `002` adds missing `metadata` column |
| Pricing/fee transparency | PASS at API layer | `GET /v1/compliance/fee-disclosure` (exact integer-cent split, fee seller-borne) |
| Provider onboarding intake (config-driven) | PASS — implemented | 6 provider types, required verification fields, SELLER-gated |
| SELLER-role enforcement on marketplace heartbeat | PASS — fixed | `authorize(['SELLER'])` (known authz bug closed) |
| Retention registry + configurable sanctions layer | PASS (config layer) | `retention.ts`, `sanctions.ts` (empty by default — no fabricated lists) |
| Honest payout messaging | PASS — fixed | `billing/withdraw` no longer claims a false ETA; discloses no disbursement rail |
| Consent captured at registration | FAIL | The `REGISTER` gate is defined but a pre-auth acceptance path does not exist |
| Email verification | FAIL | Not implemented |
| KYC pipeline | FAIL | `kyc_level` vestigial; no verification flow |
| App UIs for acceptance / dispute self-service / payoff display | FAIL | Backend exists; client surfaces not shipped |
| Marketplace payout/disbursement | BLOCKED / PROVIDER CAPABILITY REQUIRED | `payments.payouts` rows are written; no money movement |
| Cross-border transfer safeguards / processor geography | UNKNOWN | Not provable from repo |
| ODPC registration / DPO / license applications / breach-notification timeline | LEGAL REVIEW REQUIRED | Not addressed by code; needs counsel + agencies |

Full control-by-control detail: [compliance-matrix.md](./compliance-matrix.md)
(27 PASS, 11 PARTIAL, 6 FAIL, 1 BLOCKED, 1 UNKNOWN, 4 LEGAL REVIEW REQUIRED,
1 NOT APPLICABLE).

---

## 2. IDENTIFIED LEGAL QUESTIONS (addressed to qualified counsel)

1. **Kenya DPA 2019 applicability & registration.** Is DRAVIO a data controller
   under the DPA 2019, does it need ODPC registration, and is a DPO required?
   (Mark: LEGAL REVIEW REQUIRED. No registration number is claimed.)
2. **Lawful basis for processing.** Which bases apply for the fields actually
   collected (transaction data, device UUID, seller geo) — contract vs
   legitimate interest vs consent — and does Kenya require consent for
   processing beyond transactional necessity?
3. **Deletion adequacy.** The implemented deletion removes profile/identity
   rows but retains pseudonymous UUIDs in financially significant tables
   (transactions, ledger, payouts, earnings, invoices, usage, routing, audit).
   Is that "deletion/anonymization" sufficient, or does Kenyan law require
   scrubbing/destruction of those identifiers for DSARs? (Flagged by the
   data-subject-rights implementation doc.)
4. **Cross-border transfers.** Where do processors actually store data (no
   geo-configuration in repo)? Does transfer outside Kenya require ODPC consent
   or transfer safeguards? (UNKNOWN today.)
5. **Communications Authority licensing.** Does marketplace resale of third-party
   connectivity (hotspots/relay) constitute a licensable service under the Kenya
   Information and Communications Act / CA regulations — and would DRAVIO be the
   type of entity needing authorization, or merely a reseller whose providers
   carry obligations? Classified LIKELY/POSSIBLY REQUIRED or NOT IDENTIFIED in
   [kenya-communications-regulatory-assessment.md](./kenya-communications-regulatory-assessment.md);
   CA confirmation required. No "no license needed" assertion is made.
6. **AML/POCAMLA classification.** Is DRAVIO (pre-funded wallet marketplace, no
   KYC, non-functional payouts) a "reporting institution" or designated non-
   financial business under POCAMLA/Anti-Money Laundering Act? (See
   [aml-kyc-assessment.md](./aml-kyc-assessment.md).) Payout rail absence currently
   makes disbursement AML obligations moot but BLOCKED.
7. **Currency legality.** Wallet balances denominated in USD while M-Pesa
   settles KES; static FX rate. Is holding/pre-funding in USD lawful in Kenya
   on this model, and is the FX approach acceptable? (PARTIAL/LEGAL REVIEW
   REQUIRED.)
8. **PCI scope.** HTTPS + hosted checkout means PAN/CVV never enter DRAVIO, but
   whether the model keeps DRAVIO out of PCI-DSS cardholder-data environment
   scope is contract-dependent (LEGAL REVIEW REQUIRED).
9. **Breach notification.** What is the mandated notification window/authority
   for a personal-data breach in Kenya? No number is assumed or asserted
   anywhere in this repo.
10. **Consumer protection (CA).** Promotion of pricing transparency (fee
    disclosure) and dispute-handling expectations under CA consumer rules —
    the buyer-visible breakdown is API-level only today.

---

## 3. AUTHORITATIVE SOURCES (consult before acting — not conclusions)

- Kenya Data Protection Act, 2019 (Act No. 24) and its Regulations (2021).
- Office of the Data Protection Commissioner (ODPC) — registration, DSAR,
  and breach-notification guidance.
- Kenya Information and Communications Act and Communications Authority of
  Kenya (KCA/CA) licensing & consumer-protection frameworks.
- Central Bank of Kenya and POCAMLA / Anti-Money Laundering and Combating of
  Terrorism Financing Laws (as applicable to payment/wallet models).
- PCI Security Standards Council — SAQ/DSS guidance (scope analysis only).
- Stripe / Safaricom Daraja integrator agreements for processor terms.

Where this repo cites these, it cites them as open questions, not answers.

---

## 4. ITEMS REQUIRING QUALIFIED COUNSEL (priority order)

1. Confirm DRAVIO's processor/controller, ODPC registration + DPO posture.
2. Rule on DSAR deletion adequacy (pseudonymous UUID retention).
3. Rule on CA licensing classification for hotspot resale.
4. Rule on POCAMLA reporting-institution status.
5. Author legally reviewed versions of the platform policies
   ([policies](../policies/)) and approve activation of any country restriction.
6. Approve retention durations and the career of the USD/KES static FX rate.

---

## 5. WHAT WAS BUILT THIS SESSION (engineering record)

**Schema (`backend/migrations/002_compliance.sql`, idempotent):**
- `audit.audit_log.metadata JSONB` (fixes the consumer/schema mismatch).
- `compliance.transaction_events` (immutable transition audit trail).
- `compliance.privacy_requests` (DSAR requests + status workflow).
- `compliance.provider_intake` (onboarding intake records).
- `compliance.policy_acceptances` (versioned acceptances, UNIQUE per
  user/policy/version).
- `compliance.retention_rules` (seeded registry; durations are config).
- `compliance.sanctions_config` (empty by design).

**Pure, zero-dependency modules (unit-tested):**
- `payment/core/transaction-machine.ts` — lifecycle + authorization rules.
- `compliance/pure/privacy-rights.ts` — rights classification, correction
  whitelist, deletion partition plan, request-state machine.
- `compliance/pure/policy-registry.ts` — versioned catalog + gates.
- `compliance/pure/provider-intake.ts` — provider-type config + validation.
- `compliance/pure/fee-disclosure.ts` — exact split + buyer statement.
- `compliance/pure/retention.ts`, `pure/sanctions.ts`, `pure/audit-events.ts`.

**APIs (all authenticated + ownership/role-scoped):**
- `POST /v1/compliance/acceptance`, `GET /v1/compliance/acceptance/status`
- `GET /v1/compliance/policies`, `GET /v1/compliance/retention`
- `GET /v1/compliance/fee-disclosure`, `GET /v1/compliance/country-restrictions`,
  `GET /v1/compliance/country-check`
- `POST /v1/privacy/requests`, `GET /v1/privacy/requests[/:id]`,
  `POST /v1/privacy/requests/:id/withdraw|review`
- `POST /v1/provider/intake`, `GET /v1/provider/intake`
- `POST /v1/payments/:id/dispute`, `POST /v1/payments/:id/status`
  (REFUND/PARTIAL_REFUND/REVERSE/CANCEL — BILLING_ADMIN), `GET /v1/payments/:id/history`
- Purchases gated on buyer_terms acceptance.

**Fixed issues:**
- Heartbeat had no SELLER-role check → now `authorize(['SELLER'])`.
- `billing/withdraw` fabricated "funds arrive within 1-3 business days" →
  now an honest disclosure (no payout rail).
- Audit consumer wrote a `metadata` column that did not exist → `002` adds it.

**Test evidence:** `npm run test:compliance` = 43 tests; full backend `npm test`
= 80/80 pass; `npx tsc --noEmit` clean; live boot verified `/health`,
`/v1/compliance/policies` (5), `/v1/compliance/retention` (15),
`/v1/compliance/fee-disclosure?amount=10` (buyer 10 / seller net 8),
and the heartbeat SELLER gate (401 unauthenticated, 403 for a BUYER token).

---

## 6. KNOWN GAPS (honest, not hidden)

- **No consent capture at registration** — the `REGISTER` gate cannot be
  satisfied by the current authenticated-only acceptance endpoint. Needs a
  pre-account-creation acceptance flow (or lawful-basis rationale from counsel).
- **DSAR deletion retains pseudonymous UUIDs** in financial/routing tables —
  erasure adequacy unresolved.
- **No app UI** (mobile/buyer-web/admin) surfaces acceptance, fee disclosure,
  dispute self-service, or rights requests yet.
- **No email verification**, no real KYC.
- **No log shipping/SIEM**; audit trail durability depends on Kafka availability.
- **Payouts non-functional** (disbursement blocked).
- **Marketplace heartbeat SELL gate**: provider terms gate is defined but not
  enforced on listing/publish endpoints.
- **M-Pesa sandbox URL fallback** still present (production switch incomplete).

---

*This technical report intentionally never uses the phrase "fully compliant".*
Load-bearing next action: engage qualified Kenyan counsel on the questions in
§2 before any launch in Kenya.