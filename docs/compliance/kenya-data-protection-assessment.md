# DRAVIO — Kenya Data Protection Assessment

Status of this document: **engineering assessment, not a legal opinion**.
Scope: every personal-data field the DRAVIO codebase actually collects, against the
Kenya Data Protection Act, 2019 (No. 24 of 2019). Every "status" below is grounded in
code that was read and verifiable; nothing passes on the basis of intent or prose.
Where the law is open to interpretation the status is `LEGAL REVIEW REQUIRED` and the
question is listed rather than answered.

Statuses used: `PASS` / `PARTIAL` / `FAIL` / `NOT APPLICABLE` / `UNKNOWN` / `LEGAL REVIEW REQUIRED` / `BLOCKED`.

---

## 1. CURRENT TECHNICAL IMPLEMENTATION — personal-data inventory

Sources: `master_init.sql`, `backend/migrations/001_hardening.sql`,
`backend/migrations/002_compliance.sql`, `backend/src/modules/compliance/pure/*.ts`,
`backend/src/modules/privacy/*`, `backend/src/modules/auth/*`, `backend/src/modules/payment/*`,
`services/billing-service/**`, `apps/mobile-app/src/services/device.ts`,
`apps/buyer-web/src/lib/device.ts`.

### 1.1 Field inventory (column → lifecycle)

> DB references are to the exact schema/column names as implemented.
> "Retention (per registry)" refers to `compliance.retention_rules` (002 seed) /
> `backend/src/modules/compliance/pure/retention.ts`. Durations are configuration, not
> legal minimums. `[none]` means no registry category covers the column — a documented gap.

| # | Field (`table.column`) | Collected purpose (as implemented) | Requested / Optional | Legal basis (draft) | Retention (per registry) | Storage | Shared with | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `auth.users.email` | Login identifier / account identity | REQUIRED at register | Contract (account issue & support) | `auth.credentials` 36500d, erasable | Postgres | none (internal) | Stored raw; JWT carries no email |
| 2 | `auth.users.password_hash` | Password authentication (bcrypt cost 10, `bcrypt.hash(input.password, 10)`) | REQUIRED for password login; ABSENT for OAuth/OTP-only accounts | Contract (account issue & support) / security | `auth.credentials` 36500d, erasable | Postgres | never shared | Never returned by any envelope; access envelope excludes it |
| 3 | `auth.users.roles` | Authorization (default `ARRAY['BUYER']`) | SYSTEM (role at registration) | Contract / legitimate interest | [none] (ride-along on account) | Postgres | listed in JWT | Copied into JWT `{sub, roles, role}` |
| 4 | `users.profiles.full_name` | Display/identity on the marketplace | REQUIRED in buyer-web register form; `'User'` default for OAuth/OTP signup | Contract (account) | `auth.credentials` 36500d, erasable | Postgres | public to other users only if shown in UI (not implemented) | Correction-editable via DSAR (`full_name`) |
| 5 | `users.profiles.email` | Denormalised copy of login email | OPTIONAL (nullable; null for phone-OTP accounts) | Contract (account) | `auth.credentials` | Postgres | never | Detail: keeps an email copy after `auth.users.email`; both erased together on deletion |
| 6 | `users.profiles.phone_number` | Contact + M-Pesa top-up phone + phone-OTP login | OPTIONAL for most; REQUIRED for OTP/M-Pesa flows | Contract (service provision) | `auth.credentials` (profile) 36500d | Postgres | M-Pesa (STK push sees the phone number), Twilio (OTP SMS, if configured) | Correction-editable via DSAR (`phone_number`) |
| 7 | `users.profiles.country_code` | Jurisdiction hint | OPTIONAL — default `'US'` via register schema (`z.string().length(2).optional().default('US')`) and enforced in OAuth/OTP profile creation | Contract / legal | `auth.credentials` | Postgres | country-limited provider intake gate reads it | **Data-quality flag**: a Kenya product defaults new accounts to `US`; inventory will mislabel KE users |
| 8 | `users.profiles.kyc_level` | KYC tier | SYSTEM — always remains default `0` | [none] | [none] | Postgres | none | **Vestigial**: no KYC pipeline writes or reads it (see aml-kyc-assessment.md) |
| 9 | `users.profiles.is_seller` | SELLER capability + withdrawal gate | SYSTEM (derived from role) | Contract (seller provision) | [none] | Postgres | internal | `POST /v1/billing/withdraw` returns 403 unless true |
| 10 | `auth.providers.provider_name` / `provider_id` / `provider_email` | Linked identity providers (google/apple/github/microsoft/facebook/x) and `phone` OTP | REQUIRED at OAuth/OTP login | Contract (authentication) | `auth.social_providers` 36500d, erasable | Postgres | the identity provider itself (verification round-trip) | `provider_id` is provider-subject; envelope returns `provider_name`/`provider_email` only |
| 11 | `auth.refresh_tokens.token_hash` | Session refresh (hashed; plaintext never stored) | SYSTEM | Security (session management) | `auth.refresh_tokens` 30d | Postgres | never | Hashed by `auth/security`; access envelope never returns token material |
| 12 | `billing.sessions.hardware_id` | Billing session binding | REQUIRED to start a session | Security / fraud prevention | `device.identifier` 3650d | Postgres | none (mobile `device.ts` generates `Crypto.randomUUID()`, stored in secure-store; web `lib/device.ts` `crypto.randomUUID()` in localStorage) | **NOT a MAC/IMEI** — client-generated UUID. Device-fingerprint risk-scoring code is dead code (`auth/security.ts` not invoked) |
| 13 | `billing.sessions.session_token` | Active-session capability | SYSTEM (generated server-side) | Contract / accounting | `billing.sessions` 3650d | Postgres + Redis `session:${token}` | upstream relay/socket scope only | Redacted from audit events; retained as pseudonymous on deletion |
| 14 | `billing.sessions.customer_id` | Wallet linkage | SYSTEM | Contract / accounting | `billing.sessions` 3650d | Postgres | none | On DELETION rewritten to `deleted:<uuid>` |
| 15 | Seller geo coordinates (Redis `active_sellers_geo` lat/lon + `seller:*` heartbeat metadata) | Geo-located seller discovery | REQUIRED when publishing a heartbeat (`POST /v1/marketplace/heartbeat`) | Contract / legitimate interest | [none] — Redis seller keys TTL 300s; geo set members unbounded | Redis | exposed via `GET /v1/marketplace/search` and `/v1/marketplace/sellers` | Implicit location of a natural-person seller; no consent record exists for this collection |
| 16 | `compliance.policy_acceptances.ip_address` (INET) + `user_agent` | Proof/context of acceptance | SYSTEM (captured at `POST /v1/compliance/acceptance`) | Legitimate interest (acceptance evidence) | [none] — no registry category covers acceptance records | Postgres | none | Dedicated retention category missing from registry — a gap |
| 17 | `audit.audit_log.actor_id` + `metadata` | Governance/security logging | SYSTEM | Legal requirement & security | `audit.audit_log` 36500d | Postgres (via Kafka consumer) | none | `actor_id` survives deletion as a pseudonymous UUID |
| 18 | Kafka event payloads (`dm.payment.completed` → `userId`, `mpesaReceipt`, `amount`; `dm.session.kill` → `sessionToken`, `hardwareId`, `userId`; `dm.audit.log` → `actor_id`+metadata) | Async payment/session/audit processing | SYSTEM | Contract / legal requirement | topic retention `UNKNOWN` (no config in repo); consumers write only aggregates to `analytics.metrics` | Kafka | consumers: analytics-aggregator, admin relay, audit consumer | `dm.audit.log` events are REDACTED by `audit-events.ts` (sensitive-key scrubbing) |
| 19 | `payments.transactions.user_id` / `session_id` / `provider_ref` / `amount_usd` | Financial record (payment execution) | SYSTEM | Legal requirement (accounting) | `payments.transactions` 7300d, kept (not erasable) | Postgres | Stripe / M-Pesa provider references | Retained on deletion without a `deleted:` marker (identity rows removed, raw UUID remains) |
| 20 | `billing.ledger_entries.user_id` | Immutable money-movement audit trail | SYSTEM | Legal requirement (accounting) | `billing.ledger_entries` NULL (kept) | Postgres | none | Append-only; retained on deletion |
| 21 | `sessions.sessions.buyer_id` / `seller_id` | Session routing linkage | SYSTEM | Contract & accounting | `sessions.routing` 3650d | Postgres | none | Plan lists as anonymizable, but `applyDeletion` does **not** rewrite these columns (see §3) |
| 22 | `billing.wallets.customer_id` (`balance_usd`, `escrow_usd`) | Pre-funded wallet balance | SYSTEM | Contract (service provision) | `billing.wallets` 36500d, erasable | Postgres | none | Wallet row deleted on DSAR DELETION |
| 23 | `billing.seller_earnings.seller_id`, `payments.payouts.seller_id` | Seller entitlement / payout request | SYSTEM | Contract & accounting | 7300d, kept | Postgres | none | No `deleted:` marker applied on deletion |
| 24 | `analytics.session_telemetry` (`session_id`) | Time-series telemetry table | SYSTEM (schema only) | Contract & network ops | `analytics.session_telemetry` 730d | Postgres | none | **No writer found in repo** — table exists (V14 migration), nothing inserts it |
| 25 | `analytics.metrics` (aggregate counters) | Product metrics | SYSTEM | Legitimate interest (product) | `analytics.metrics` NULL (kept) | Postgres | none | Aggregates only; no personal identifiers retained |

### 1.2 Out-of-scope / not collected (verified absence)

- NO date-of-birth, age, children, or parental data anywhere in any schema — no minors-targeting collection.
- NO card number / CVV ever reaches DRAVIO (Stripe hosted checkout; see payment-security-scope.md).
- NO browsing history, DNS queries, or traffic content collection (mobile `Legal.tsx` claims this; consistent with what code stores — only byte counts).
- NO device MAC/IMEI/telemetry fingerprinting.

### 1.3 Claimed-but-inconsistent vendor disclosures (flag)

`apps/mobile-app/src/screens/Legal.tsx` (Privacy Policy, "Last updated: May 2026") contains statements that do not match this repo's implementation and should be corrected by counsel before any reliance:

- "Session records are retained for 12 months" vs registry `billing.sessions` = 3650 days (10 yrs).
- "Earnings are paid out weekly" / "platform fee ... displayed at time of transaction" — no payout mechanism exists and no purchase-time breakdown UI consumes `GET /v1/compliance/fee-disclosure`.
- The user note referenced `apps/buyer-web/src/pages/Legal.tsx`; **that file does not exist** in the working tree, and no app UI calls `/v1/compliance/fee-disclosure`, `/v1/privacy/requests`, `/v1/compliance/acceptance`, or `/v1/provider/intake` (verified by repo-wide grep). The fee-disclosure endpoint is backend-only today.

---

## 2. Kenya DPA 2019 applicability — control-by-control status

Authority assessed: **Kenya Data Protection Act, 2019 (Act No. 24 of 2019)** and the
Data Protection (General) Regulations, 2021. Statuses are engineering evidence only.

| Control | Status | Evidence / rationale |
|---|---|---|
| Data inventory & records of processing | `PARTIAL` | This assessment + `master_init.sql` + retention registry constitute a first inventory; no formal records-of-processing register exists in code or docs. |
| Lawful basis for processing | `PARTIAL` / `LEGAL REVIEW REQUIRED` | Registry records *draft* bases (Contract / Security / Legal-requirement / Legitimate-interest). A legitimate-interest balancing test is not documented; bases for OAuth/OTP and geo-listing are not evidenced. |
| Consent mechanism | `FAIL` | No pre-registration consent is recorded. `GET/POST /v1/compliance/policies` + `POST /v1/compliance/acceptance` exist, but the `REGISTER` gate (`requiredGates: ['REGISTER']`) is **not enforced** on `POST /v1/auth/register`; acceptance requires an authenticated session (chicken-and-egg). Policy TEXT files under `/docs/policies/*` referenced by `policy-registry.ts` do not exist in the repo. |
| Purchase-gate consent | `PASS` | `POST /v1/payments/initiate` returns `403 POLICY_ACCEPTANCE_REQUIRED` unless current `buyer_terms` v1.0 accepted (`payment.service.ts`). |
| DSAR mechanism (backend) | `PASS` | `POST /v1/privacy/requests` accepts ACCESS/CORRECTION/OBJECTION/DELETION/PORTABILITY with state machine PENDING→IN_REVIEW→COMPLETED/REJECTED/WITHDRAWN and CAS-guarded transitions. |
| DSAR availability to subjects (UI/channel) | `PARTIAL` | No client UI or batch/export tooling calls the APIs; no verified email channel. |
| Deletion (erasure plan) | `PARTIAL` | Real transaction-scoped erasure executes (`applyDeletion`). Limits are honest but partial: only `billing.sessions.customer_id` is rewritten to `deleted:<uuid>`; other retained financial tables keep the raw UUID; `sessions.routing` is untouched despite the plan listing it as anonymizable. |
| Cross-border transfers | `UNKNOWN` / `LEGAL REVIEW REQUIRED` | See cross-border-data-flow.md; no geo-location of processors provable from the repo; no transfer safeguards documented. |
| Breach notification | `FAIL` / `LEGAL REVIEW REQUIRED` | No breach-detection or notification procedure exists; the statutory notification timeline is `UNKNOWN` here and must be confirmed with counsel — this document does not assert any timeline. |
| Data controller / processor roles | `PARTIAL` / `LEGAL REVIEW REQUIRED` | DRAVIO acts as controller for core data and processor vis-à-vis Stripe/Safaricom/Twilio; no DPA or processor agreements are present in the repo. |
| ODPC registration | `UNKNOWN` / `LEGAL REVIEW REQUIRED` | No evidence of registration in the repo. Whether DRAVIO falls within ODPC registration categories is a legal question. |
| Data Protection Officer | `UNKNOWN` / `LEGAL REVIEW REQUIRED` | No DPO role, record, or designation exists in code. Whether a DPO is mandatory for DRAVIO is a legal question. |
| Privacy notice to data subjects | `PARTIAL` | A privacy screen exists (`apps/mobile-app/src/screens/Legal.tsx`) but it is not acceptance-gated, is dated May 2026 (this session is Sept 2026), and contradicts the repo in places (see §1.3). |
| Children / age handling | `LEGAL REVIEW REQUIRED` | Terms claim 16+ eligibility; **no age/DOB is collected and no age-verification mechanism exists**, so DRAVIO cannot evidence it processes no children. Whether the DPA's special provisions for children apply is an open legal question. |
| Security of processing (tech) | `PARTIAL` | bcrypt cost 10, hashed refresh tokens, TLS in transit (claimed in docs), audit logging wired, REDACTION of sensitive event metadata. At-rest encryption, key rotation, and secrets documentation are not verifiable in the repo. |
| Data minimisation | `PASS` | Schema inspection confirms no DOB/age; `hardware_id` is a client UUID (not MAC/IMEI); raw traffic content is not stored. |
| Vendor/third-party disclosure | `LEGAL REVIEW REQUIRED` | Stripe / Safaricom (M-Pesa / Daraja) / Twilio / OAuth providers / (optional) Cloudinary+Firebase. No repository evidence of DPAs or transfer safeguards. |

---

## 3. IDENTIFIED LEGAL QUESTIONS (open — require qualified counsel / ODPC)

1. What is the correct lawful basis / consent wording for (a) geo-location of sellers into a public marketplace listing, (b) IP + user-agent capture at policy acceptance, (c) OAuth identity linking?
2. Does the DPA 2019 require DRAVIO — a data marketplace — to register with the ODPC and to designate a Data Protection Officer (which DPA category applies)?
3. Is a legitimate-interest balancing test needed for retention of financial records beyond account life, and are the registry durations (e.g. `billing.sessions` 3650d) defensible? The durations are **configuration, not legal minimums**.
4. What is the actual breach-notification timeline and process requirement under the DPA 2019 / ODPC guidance? (DRAVIO has none today.)
5. Are cross-border transfers to Stripe (US), Twilio (US), Google/Apple/GitHub/Microsoft/Facebook/X (US), and Safaricom (Kenya) permitted without additional safeguards, and which adequacy/consent/standard-contractual-clause route applies?
6. Does the retention of raw user UUIDs in `payments.transactions.user_id`, `billing.ledger_entries.user_id`, `payments.payouts.seller_id`, `billing.seller_earnings.seller_id`, `billing.invoices.customer_id`, `billing.usage_records.customer_id`, `sessions.sessions.(buyer|seller)_id` after DELETION satisfy the DPA's erasure requirement, or must those columns be pseudonymized with an explicit marker?
7. Is `hardware_id` (a client-generated UUID stored in secure-store/localStorage) personal data for DPA purposes, and is the current disclosure in the privacy screen sufficient?
8. Is the `country_code` default of `US` (rather than `KE`) a data-quality issue that skews notice/consent and risk-based controls for Kenyan users?

---

## 4. AUTHORITATIVE SOURCES

This section lists the instruments used to frame the questions above; it does **not**
assert legal answers. Counsel should confirm the current, in-force text.

- **Kenya Data Protection Act, 2019 (Act No. 24 of 2019)** — the primary statute under which the questions in §3 arise: rights of data subjects, controller/processor obligations, cross-border transfer, breach notification, registration, DPO duties.
- **The Data Protection (General) Regulations, 2021** — subsidiary rules referenced for the question of registration/duties; exact obligations to be confirmed with qualified counsel.
- **Office of the Data Protection Commissioner (ODPC)** — the authority for registration, complaints, and guidance; DRAVIO has not demonstrated engagement with it.
- Legislation is cited only as the *source* of the open questions — no statutory answer in this document is asserted as fact.

---

## 5. ITEMS REQUIRING QUALIFIED COUNSEL (next actions)

- Draft and gate the actual policy texts under `/docs/policies/` (currently referenced-but-missing) and enforce the `REGISTER` gate end-to-end.
- Obtain a DPA-2019 opinion on licensability/registration classification, DPO designation, lawful-basis validation, and retention durations.
- Stand up breach-notification procedure and a records-of-processing register.
- Decide the DELETION pseudonymization policy for retained financial rows (raw UUID vs explicit `deleted:` marker) — an honest, counsel-validated trade-off of accounting integrity vs erasure.
- Correct the vendor/text inconsistencies flagged in §1.3 before the privacy notice is represented as current.