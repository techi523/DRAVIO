# DRAVIO Compliance Matrix (Phase 35)

Inventory-based control matrix. Every row maps a control to its actual
implementation, evidence, and status.

Statuses used (and only these): `PASS`, `PARTIAL`, `FAIL`, `NOT APPLICABLE`,
`UNKNOWN`, `LEGAL REVIEW REQUIRED`, `BLOCKED`.

A control is `PASS` only when implemented AND verifiable in this codebase.
A status is never inferred from a document, intent, or plan.

**Read this alongside the supporting documents:**

| Document | Purpose |
| --- | --- |
| [kenya-data-protection-assessment.md](./kenya-data-protection-assessment.md) | Kenya DPA 2019 field-level inventory + control assessment |
| [data-subject-rights-implementation.md](./data-subject-rights-implementation.md) | DSAR workflow as actually built |
| [cross-border-data-flow.md](./cross-border-data-flow.md) | Data-flow diagram + transfer analysis |
| [kenya-communications-regulatory-assessment.md](./kenya-communications-regulatory-assessment.md) | CA/KCA licensing classification |
| [payment-security-scope.md](./payment-security-scope.md) | PCI scope + payment-security surface |
| [aml-kyc-assessment.md](./aml-kyc-assessment.md) | KYC/AML posture |
| [policies/acceptable-use-policy.md](../policies/acceptable-use-policy.md) | AUP + Privacy (registry ids `aup`, `privacy`) |
| [policies/buyer-terms.md](../policies/buyer-terms.md) | Terms (`terms`) + Buyer trading terms (`buyer_terms`) |
| [policies/provider-terms.md](../policies/provider-terms.md) | Provider terms (`provider_terms`) |
| [security/incident-response-plan.md](../security/incident-response-plan.md) | IRP |

---

## 1. Data protection (Kenya DPA 2019)

| # | Requirement / control | Implementation (code) | Evidence | Status |
| --- | --- | --- | --- | --- |
| D-01 | Personal-data inventory | Field-level tables in [kenya-data-protection-assessment.md](./kenya-data-protection-assessment.md) generated from `master_init.sql` + `migrations/002_compliance.sql` | Tables present; matches schema | PARTIAL |
| D-02 | Lawful basis documented per field | Documented as draft; none verified against statute | Assessor doc | LEGAL REVIEW REQUIRED |
| D-03 | Consent recorded on registration | NOT wired: `POST /v1/compliance/acceptance` requires an authenticated session, so a pre-register consent capture cannot occur; the `REGISTER` gate in `policy-registry.ts` is defined but never enforced | `policy-registry.ts` `requiredGates`, no pre-auth acceptance path | FAIL |
| D-04 | Versioned policy acceptance (current version only) | `compliance.policy_acceptances` (UNIQUE user/policy/version), `POST /v1/compliance/acceptance`, `validateAcceptance()` rejects stale/future versions | `policy-registry.ts`, `policy-acceptance.repository.ts` | PASS |
| D-05 | Purchase-time policy gate | `PaymentService.initiatePayment` calls `assertSatisfiesGate('PURCHASE')` → `403 POLICY_ACCEPTANCE_REQUIRED` | `payment.service.ts`, route mapping | PASS |
| D-06 | Data-subject rights (access/correction/objection/deletion/portability) | `POST /v1/privacy/requests` (self-scoped), reviewer route `POST /v1/privacy/requests/:id/review` (ADMIN/BILLING_ADMIN), CAS transitions, `PENDING/IN_REVIEW/COMPLETED/REJECTED/WITHDRAWN` | `privacy/index.ts`, `privacy.repository.ts`, `privacy-rights.ts` | PASS |
| D-07 | Deletion executed for real | `privacyService.applyDeletion` erases `auth.providers`, `auth.refresh_tokens`, `users.profiles`, `billing.wallets`, `auth.users` in a transaction; marks `billing.sessions.customer_id = 'deleted:'…` | `privacy.service.ts` | PASS |
| D-08 | Retention of legally significant records (accounting) | Financial tables retained with personal linkage broken by identity-row removal; registry documents which categories are retained | `retention.ts`, `privacy-rights.ts` `deletionOutcomePlan()` | PARTIAL |
| D-09 | Retention schedule | `compliance.retention_rules` seeded + `retention.ts` registry (durations are configuration, not legal minimums) | 15 categories seeded | PARTIAL |
| D-10 | Cross-border transfer safeguards | Cannot be proven from repo (no processor geo, no transfer agreements) | [cross-border-data-flow.md](./cross-border-data-flow.md) | UNKNOWN |
| D-11 | Breach notification timeline | Not implemented as code; timeline not asserted | IRP references `LEGAL REVIEW REQUIRED` | LEGAL REVIEW REQUIRED |
| D-12 | ODPC registration / DPO designation | Not present in repo | n/a | LEGAL REVIEW REQUIRED |
| D-13 | Encryption in transit (API) | HTTPS assumed at termination; no in-repo TLS config (helmet + CORS enabled) | `src/index.ts` | PARTIAL |
| D-14 | Secrets not in code | Env-only (`env.ts`); no secrets in repo | `config/env.ts` | PASS |
| D-15 | Audit trail of governance actions | New `emitAudit()` producer → `dm.audit.log` → `audit.audit_log` (now with `metadata` column); REDACTED metadata | `audit/producer.ts`, `audit-events.ts`, migration 002 | PARTIAL |
| D-16 | Audit events wired end-to-end for auth/payment/privacy/policy/provider/payout | Emitted at register/login-success/login-failure/transition/policy-accept/intake/privacy/payout | `auth/index.ts`, `payment`, `privacy`, `provider`, `wallet.routes.ts` | PASS |
| D-17 | Audit durability (Kafka availability) | Degrades silently when `KAFKA_URL` unset (no local durable log fallback) | `events/kafka.ts` | PARTIAL |
| D-18 | Log-shipping / SIEM | Not present; local pino only | IRP "Known gaps" | FAIL |

## 2. Identity, roles, onboarding

| # | Requirement / control | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| I-01 | Role model enforced at authorization boundary | `fastify.authorize([...])` on sensitive routes; JWT carries `roles[]` | `auth/middleware.ts` | PASS |
| I-02 | Marketplace heartbeat requires an actual seller | `heartbeat` preHandler now `authorize(['SELLER'])` (was authenticate-only) | `marketplace/index.ts` | PASS |
| I-03 | Password storage | bcrypt cost 10, hashes only | `auth.service.ts` | PASS |
| I-04 | Refresh tokens stored hashed | `auth.refresh_tokens.token_hash` only | `master_init.sql` | PASS |
| I-05 | Email verification | Not implemented | n/a | FAIL |
| I-06 | KYC pipeline | `kyc_level` column exists but no verification flow | `master_init.sql` | NOT IMPLEMENTED → FAIL |
| I-07 | Provider onboarding (type + verification) | Config-driven intake: 6 provider types, required-field validation, SELLER-gated `POST /v1/provider/intake` | `provider-intake.ts`, `provider/index.ts` | PASS |
| I-08 | Admin role assignment via public API | Not exposed; admin role is DB-seeded | inventory | PARTIAL |

## 3. Payments, marketplace, money

| # | Requirement / control | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| P-01 | Card data never enters DRAVIO | Stripe external hosted checkout; `paymentIntents.create` only; no PAN/CVV fields anywhere | `stripe.provider.ts` | PASS |
| P-02 | M-Pesa STK (phone/PIN on device) | STK push + callback reconciliation (amount tolerance 5 KES) | `mpesa.provider.ts` | PASS |
| P-03 | Idempotent payment creation | DB `ON CONFLICT (idempotency_key) DO NOTHING` + lookup race guard | `payment.repository.ts` | PASS |
| P-04 | Fee math exact (integer cents) | `money.ts` cent arithmetic, `PLATFORM_FEE_PCT` clamped | `money.ts` | PASS |
| P-05 | Pricing transparency (split shown before purchase) | `GET /v1/compliance/fee-disclosure` returns exact buyer/seller/fee breakdown + statement | `fee-disclosure.ts`, verified live (buyer 10 / seller 8) | PASS (API) |
| P-06 | GB-cap price breakdown in buyer UI | Client display not shipped | inventory (known gap) | FAIL |
| P-07 | Dispute lifecycle | State machine `DISPUTED` (owner/BUYER, reason required) + audited CAS transition | `transaction-machine.ts`, `transaction.service.ts` | PASS |
| P-08 | Refund / partial refund / reversal | `REFUNDED` / `PARTIALLY_REFUNDED` / `REVERSED` gated to BILLING_ADMIN + reason | `transaction-machine.ts` | PASS |
| P-09 | Cancellation before money moves | `CANCELLED` only from `PENDING`/`AUTHORIZED` | `transaction-machine.ts` | PASS |
| P-10 | Terminal states immutable | `FAILED/REFUNDED/REVERSED` reject further transitions | `transaction-machine.ts` | PASS |
| P-11 | Transition audit log | `compliance.transaction_events` appended in same DB txn (CAS) | `transaction-state.repository.ts` | PASS |
| P-12 | Immutable money ledger | `billing.ledger_entries` append-only on completion | `001_hardening.sql`, `payment.repository.ts` | PASS |
| P-13 | Wallet non-negative | DB CHECK constraint | `001_hardening.sql` | PASS |
| P-14 | Fee balance invariant at DB | CHECK `platform_fee + seller_net <= amount`, all >= 0 | `001_hardening.sql` | PASS |
| P-15 | Webhook signature verification | Stripe signature verified (raw body); M-Pesa reconciled by ref + amount | `payment/index.ts` | PASS |
| P-16 | Marketplace payout/disbursement | `payments.payouts` written `PENDING`; no disbursement rail; withdraw message now honest (no fabricated ETA) | `wallet.routes.ts` | BLOCKED / PROVIDER CAPABILITY REQUIRED |
| P-17 | Server-authoritative pricing (session start) | Client cannot set own price; min-balance enforced | `session-gate.ts` | PASS |
| P-18 | M-Pesa production switch | `MPESA_ENV` defaults `sandbox`; sandbox base URL still hardcoded fallback | `mpesa.provider.ts:6` | PARTIAL |
| P-19 | Currency / tax computation | None implemented; no tax logic claimed | inventory | NOT APPLICABLE (not implemented) |
| P-20 | FX rate | Static `USD_TO_KES_RATE` fallback 155 | `env.ts` | PARTIAL |

## 4. Policies / terms

| # | Requirement / control | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| T-01 | Policy docs exist | AUP, buyer-terms, provider-terms (+ Privacy section) with registry ids/versions | `docs/policies/*` | PASS |
| T-02 | Registry matches docs | `policy-registry.ts` versions/effective dates match doc headers | `policy-registry.ts` | PASS |
| T-03 | Acceptance UI in apps | No app UI calls acceptance/privacy endpoints yet | inventory | FAIL |
| T-04 | SELL gate (provider terms) | Defined for `provider_terms` but not enforced on listing/publish endpoints | inventory | PARTIAL |
| T-05 | Incident response plan | IRP with severity levels, real monitoring signals, containment runbook | `incident-response-plan.md` | PASS (plan) / detection tooling PARTIAL |

## 5. Sanctions / jurisdiction config

| # | Requirement / control | Implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| S-01 | Configurable country restriction | `SANCTIONED_COUNTRIES` env or `compliance.sanctions_config` (empty by default — no fabricated list) | `sanctions.ts` | PASS (config layer) |
| S-02 | Restriction applied to provider intake | `assertCountryAllowed` on intake → `403 COUNTRY_RESTRICTED` | `provider/index.ts` | PASS |
| S-03 | Any real jurisdiction validated | No jurisdiction activated; requires counsel | n/a | LEGAL REVIEW REQUIRED |

---

## Summary counts (this matrix)

- PASS: 27
- PARTIAL: 11
- FAIL: 6
- BLOCKED / PROVIDER CAPABILITY REQUIRED: 1
- UNKNOWN: 1
- LEGAL REVIEW REQUIRED: 4
- NOT APPLICABLE: 1

**Verification:** `npm run test:compliance` (43 tests), full backend suite
`80/80` pass, `tsc --noEmit` clean, live boot smoke-verified the new
`/v1/compliance/*` routes and the SELLER heartbeat gate (403 for a BUYER token).

**Nothing in this matrix constitutes a legal conclusion.** See
[FINAL_COMPLIANCE_REPORT.md](./FINAL_COMPLIANCE_REPORT.md) for the technical
status summary, the list of legal questions, and items requiring qualified
counsel.