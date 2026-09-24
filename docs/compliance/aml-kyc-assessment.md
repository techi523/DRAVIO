# DRAVIO — AML / KYC Assessment

Honest engineering assessment of anti-money-laundering and know-your-customer controls in
the repository. Statuses: `PASS` / `PARTIAL` / `FAIL` / `NOT APPLICABLE` / `UNKNOWN` /
`LEGAL REVIEW REQUIRED` / `BLOCKED`. No compliance certification is claimed. Legal status
of "is DRAVIO a reporting institution (e.g. a designated non-financial business and
profession) under Kenya's proceeds-of-crime regime" is an open question for counsel.

Reference source framing the questions (not an answer): Kenya **Proceeds of Crime and
Anti-Money Laundering Act (POCAMLA), 2009**, the Financial Reporting Centre (FRC), and
CBK payment-oversight instruments. Statutory thresholds and reporting duties are not
asserted.

---

## 1. CURRENT TECHNICAL IMPLEMENTATION

### 1.1 Identity / KYC

- `users.profiles.kyc_level` exists (SMALLINT, default `0`) but **no code writes or reads
  it beyond schema/default**: no KYC document upload, no ID verification, no liveness or
  facial match, no risk-tier logic.
- Provider intake (`compliance.provider_intake`) collects config-driven verification
  fields per type (`INDIVIDUAL`, `BUSINESS`, `ISP`, `HOTSPOT_OPERATOR`,
  `NETWORK_OPERATOR`, `OTHER_AUTHORIZED_PROVIDER`): `legal_name`, `registration_number`,
  `business_record_attached`, optional `tax_id`/`government_id_flag`/`authorization_identifier`.
  These are **declarative, not verified programmatically** against any registry. Statuses
  SUBMITTED/APPROVED/REJECTED/WITHDRAWN.
- **Mock KYC UI caveat**: `apps/admin-portal/src/app/(dashboard)/compliance/page.tsx`
  renders a hardcoded "pending identity verifications" queue with fake rows
  (`ID_REQ_1..3`, `PASSPORT`, `FACIAL_MATCH: 98%`, `APPROVE`/`REJECT` buttons). It is
  decorative — not wired to any API or table. It must not be taken as evidence of a KYC
  pipeline (and shipping it against real users would be deceptive).

### 1.2 Transaction monitoring / thresholds

- **No transaction-monitoring thresholds, velocity checks, or risk-scoring exist.** There
  is a daily-ish cap on a single withdrawal (`MAX_WITHDRAWAL_USD = 25_000`) and a wallet
  deduct cap (`amount <= 100000`) — these are application limits, not AML monitoring.
- `auth/security.ts` defines `evaluateRiskScore(fingerprint, ip)` but it is **dead code**
  (no caller found). Device-fingerprinting is likewise not in the live path.

### 1.3 Sanctions / jurisdiction screening

- `compliance/sanctions.ts`: restricted list is **empty by default** (no fabricated
  jurisdiction). Activation requires `SANCTIONED_COUNTRIES` env or a counsel-validated
  seed of `compliance.sanctions_config`.
- Enforcement points: `POST /v1/provider/intake` calls `assertCountryAllowed(country_code)`
  (403 `COUNTRY_RESTRICTED`). `GET /v1/compliance/country-check` is informational.
- No PEP (politically exposed person) screening, no name screening, no cross-index of
  any watchlist. Status: `NOT APPLICABLE` today (nothing enabled), `LEGAL REVIEW REQUIRED`
  for what should be enabled.

### 1.4 Payout monitoring

- **Payouts are not functional.** `POST /v1/billing/withdraw` deducts the wallet and
  writes `payments.payouts` with `status='PENDING'` forever; no disbursement mechanism
  exists (no Stripe Connect, no Safaricom B2C wired to a route; `stripeProvider.createPayout`
  is defined but unused).
- Consequently **payout-side AML monitoring (destination review, beneficial owners,
  beneficiary screening, payout anomaly detection) is BLOCKED / PROVIDER CAPABILITY
  REQUIRED** — there is no payout rail to monitor.
- Withdrawn seller funds are deducted from `billing.wallets` and held in an unresolved
  `PENDING` payout row. This is both a financial-integrity issue and a consumer-protection
  issue (the response claims funds arrive in 1–3 business days).

### 1.5 Currency conversion / tax

- **No tax computation exists.** DRAVIO does not compute VAT, withholding, excise,
  or any tax. `USD_TO_KES_RATE` (static default `155.0`) is used **only** for M-Pesa
  amount reconciliation (±5 KES tolerance in `payment.service.ts`), not for invoicing or
  tax. `billing.invoices` rows carry amounts without tax fields.
- **Do not fabricate tax numbers**: no tax logic is asserted in this document.

---

## 2. Money-laundering risk register (honest)

| Risk | Exposure today | Mitigant in code | Status |
|---|---|---|---|
| Structuring / smurfing via multiple user accounts | High | None (no velocity rules) | `FAIL` |
| Layering via wallet top-up ↔ withdrawal without payout rail | High | None; withdrawal deducts wallet with no flow-through | `BLOCKED` |
| Anonymous-derived IDs (phone-OTP `@phone.dravio.local` email; OAuth-created accounts) | High | No identity verification | `FAIL` |
| Sanctions evasions by jurisdiction | Medium once listing enabled | Configurable gate only; empty by default | `PARTIAL` (mechanism) / `LEGAL REVIEW REQUIRED` |
| Provider fake identification / fake B2B onboarding | Medium | Declaration-only intake fields; no external verification | `PARTIAL` |
| Payout null-world (parked PENDING rows) as a slymium for unreconciled funds | High | None | `BLOCKED` |
| M-Pesa amount collapse/double-spend | Low-Medium | 5 KES tolerance + CAS state machine + idempotency | `PASS` |
| Cash-like abuse of Stripe metadata containing `phone_number`/`user_id` | Low | None beyond metadata hygiene | `LEGAL REVIEW REQUIRED` |

---

## 3. Control-by-control status

| Control | Status | Basis |
|---|---|---|
| KYC/KYB pipeline (ID verification, beneficial ownership) | `FAIL` | `kyc_level` vestigial; intake declarative; mock compliance UI not wired |
| Transaction monitoring (thresholds/velocity/risk scoring) | `FAIL` | No monitoring code; `evaluateRiskScore` dead code |
| Sanctions/PEP screening | `NOT APPLICABLE` (default) / `LEGAL REVIEW REQUIRED` | Gate exists but disabled by design; no PEP list, no enablement |
| Restricted-jurisdiction enforcement on onboarding | `PARTIAL` | Wired for provider intake only when configured; register/login not gated |
| Payout / AML payout monitoring | `BLOCKED` | No payout rail exists |
| Record-keeping for suspicious activity | `FAIL` | No SAR/STR or CTR logic or storage |
| Customer due diligence at onboarding | `FAIL` | Fields collected without verification |
| Currency-conversion tax / VAT computation | `NOT APPLICABLE` | DRAVIO computes no taxes (stated as fact about the code; legal obligation is a separate counsel question) |
| Transaction-state CAS + immutable event ledger (supporting evidence for any future AML tooling) | `PASS` | `compliance.transaction_events`, `billing.ledger_entries`, audit wiring |

---

## 4. Identified questions for counsel (hedged)

1. Is DRAVIO a "reporting institution" / designated non-financial business or profession
   under POCAMLA given its wallet-based marketplace, and what FRC/CBK duties follow?
2. At what transaction thresholds (and whether in KES) do suspicious-transaction and
   cash-reporting duties attach? No threshold is asserted here.
3. Whether the declarative provider intake constitutes adequate CDD for B2B onboarding, or
   whether external verification is mandatory.
4. Whether operating payouts at all — given there is no rail — creates constructive
   "money transmission" obligations that must be resolved by a licensed provider (Stripe
   Connect / Safaricom B2C / licensed PSP).
5. Whether geo-gating by `SANCTIONED_COUNTRIES` is sufficient or whether DRAVIO must
   screen against UN/EU/OFAC-plus-local lists.

Every item above is an open legal question; this assessment provides the engineering
facts, not the legal answers.