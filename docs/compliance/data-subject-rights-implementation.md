# DRAVIO — Data Subject Rights: Implementation Record

This document describes the **actual, implemented** data-subject rights workflow in the
DRAVIO backend as of this session, grounded in code. It is an engineering record, not a
legal certification. Statuses: `PASS` / `PARTIAL` / `FAIL` / `NOT APPLICABLE` / `UNKNOWN` /
`LEGAL REVIEW REQUIRED` / `BLOCKED`.

Schema source: `backend/migrations/002_compliance.sql` (§2); routes:
`backend/src/modules/privacy/index.ts`; fulfillment:
`backend/src/modules/privacy/services/privacy.service.ts`; pure rules:
`backend/src/modules/compliance/pure/privacy-rights.ts`; repository:
`backend/src/modules/compliance/repositories/privacy.repository.ts`.

---

## 1. Legal frame (hedged)

The five rights map to privacy-rights families recognised by the Kenya Data Protection
Act, 2019 (No. 24 of 2019) and GDPR-style regimes. Whether DRAVIO's implementation fully
satisfies each statutory right — and which exemptions apply to financially significant
records — is a **LEGAL REVIEW REQUIRED** question answered only by qualified counsel /
ODPC. This document records only what the code does.

---

## 2. Data model (exact)

`compliance.privacy_requests`:

| column | type | notes |
|---|---|---|
| `id` | UUID PK | server-generated |
| `requester_id` | UUID NOT NULL | authenticated subject (`auth.users.id`) who created the request |
| `right_type` | VARCHAR(20) | CHECK IN (`ACCESS`,`CORRECTION`,`OBJECTION`,`DELETION`,`PORTABILITY`) |
| `status` | VARCHAR(20) | CHECK IN (`PENDING`,`IN_REVIEW`,`COMPLETED`,`REJECTED`,`WITHDRAWN`) |
| `request_payload` | JSONB | `{}` default; normalized for CORRECTION |
| `outcome` | JSONB NULL | set on COMPLETED/REJECTED (deletion result, access envelope, or reason) |
| `reviewed_by` | UUID NULL | set on reviewer transitions |
| `created_at` / `updated_at` | TIMESTAMPTZ | server set |

Index: `idx_privacy_requests_requester (requester_id, created_at DESC)`.

The CHECK constraints make the right/status vocabulary intrinsic to the database; unknown
rights/states are rejected by the schema itself.

---

## 3. Endpoints (exact paths, methods, authorization)

| Method/path | Auth | Allowed roles | Behavior |
|---|---|---|---|
| `POST /v1/privacy/requests` | `fastify.authenticate` | any authenticated subject (roles `SYSTEM`/`SERVICE`/`ADMIN` are refused by `canCreateRequest`) | Creates `right_type` request; CORRECTION payload validated/normalized by `correctionEditableFields` (allowed: `full_name`, `phone_number`, `country_code` only) |
| `GET /v1/privacy/requests` | `fastify.authenticate` | subject | Own requests only (never a global listing) |
| `GET /v1/privacy/requests/:id` | `fastify.authenticate` | subject | Own request only (`findOwnedById`) |
| `POST /v1/privacy/requests/:id/withdraw` | `fastify.authenticate` | subject who owns the request | PENDING/IN_REVIEW → WITHDRAWN (ownership required) |
| `POST /v1/privacy/requests/:id/review` | `fastify.authorize(['ADMIN','BILLING_ADMIN'])` | reviewer | `action` ∈ `IN_REVIEW`/`COMPLETED`/`REJECTED`; reviewer-scoped lookup via `findById` |

Transitions are CAS-guarded (SQL `WHERE status = <from>` returns null on lost update) and
enforced by the pure `assertRequestTransition` (terminal states immutable;
withdrawal owner-only; review transitions reviewer-only).

---

## 4. Right profiles (automation vs human review)

From `privacy-rights.ts` — `automated`, `requiresReview`, `deliverable`:

| Right | automated | requiresReview | deliverable |
|---|---|---|---|
| `ACCESS` | true | false | envelope (human-readable JSON) |
| `CORRECTION` | true | false | envelope (fields applied by the reviewer on COMPLETE) |
| `OBJECTION` | false | true | envelope |
| `DELETION` | false | true | envelope |
| `PORTABILITY` | true | false | file (machine-readable payload) |

- ACCESS / CORRECTION / PORTABILITY are marked **automated**; DELETION and OBJECTION
  **require a human reviewer** (`ADMIN`/`BILLING_ADMIN`) before any action.
- A buyer only *requests* DELETION/OBJECTION; a privileged reviewer executes it.

---

## 5. Fulfillment on `status = COMPLETED`

`POST /v1/privacy/requests/:id/review` with `action: COMPLETED` executes:

- **DELETION** → `privacyService.applyDeletion(requester_id)`; `outcome = { deletion: { deleted, retained } }`.
- **ACCESS or PORTABILITY** → `privacyService.collectAccessEnvelope(requester_id)`; `outcome = { access_envelope }`.
- **REJECTED** → `outcome = { reason, review: 'manual' }` (body `reason` or `NO_REASON_PROVIDED`).
- CORRECTION on COMPLETE: payload was captured at create-time and is applied by the
  reviewer/operator (the code stores the normalized payload in `request_payload`; the
  reviewer inspects and applies it to the profile — no automated write is performed by the
  review route itself beyond what the operator executes).

---

## 6. The DELETION / pseudonymization plan (exact)

Pure plan (`deletionOutcomePlan`):

- **erasable**: `auth.providers`, `auth.refresh_tokens`, `users.profiles`, `billing.wallets`, `auth.users`.
- **anonymizable**: `billing.sessions` (customer_id + hardware_id → deleted marker), `sessions.routing` (buyer_id/seller_id → deleted marker).
- **retained** (financial/legal): `payments.transactions`, `billing.ledger_entries`, `payments.payouts`, `billing.seller_earnings`, `billing.invoices`, `billing.usage_records`, `analytics.metrics`, `analytics.session_telemetry`, `audit.audit_log`.

Executed in `privacy.service.ts` — single DB transaction (`BEGIN`/`COMMIT`/`ROLLBACK`):

1. `DELETE FROM auth.users WHERE id = $1` … `auth.providers`, `auth.refresh_tokens`, `users.profiles`, `billing.wallets` (each erasable table iterated; unknown erasable table → hard error `UNKNOWN_ERASABLE_TABLE`).
2. `UPDATE billing.sessions SET customer_id = 'deleted:' || $1 WHERE customer_id = $1` (pseudonymizes the one TEXT-typed identity column actually handled).
3. COMMIT; returns the plan partition. Any failure rolls back — nothing is partially erased (subject to the gaps below).

**Honest gaps in the executed plan (verified):**

- `sessions.routing.buyer_id` / `seller_id` are listed as anonymizable in the plan but
  **no UPDATE touches them** in `applyDeletion`.
- Retained financial tables keep the **raw user UUID** (no `deleted:` marker is applied to
  `user_id`/`seller_id`/`customer_id` in `payments.transactions`, `billing.ledger_entries`,
  `payments.payouts`, `billing.seller_earnings`, `billing.invoices`, `billing.usage_records`).
  Personal linkage is broken by *removing the identity rows* — the UUID remains but no PII
  row exists to join to. Whether this satisfies the DPA's erasure duty is **LEGAL REVIEW
  REQUIRED** (see §10).
- `audit.audit_log` retains `actor_id` and event metadata by design (governance log).

---

## 7. ACCESS / PORTABILITY envelope contents (exact)

`collectAccessEnvelope` returns: `requested_at`, `data_subject` (UUID), and sections:
`profile` (email, full_name, kyc_level, country_code, phone_number, is_seller),
`linked_identity_providers` (provider_name, provider_email, created_at),
`transactions` (id, amount_usd, platform_fee_usd, seller_net_usd, currency,
payment_method, status, created_at, updated_at), `billing_sessions`, `wallet`,
`ledger`, `payouts`, `seller_earnings`.

**Excluded by design:** `password_hash`, refresh-token material, `auth.providers.provider_id`
(subject identifier from the provider), full `audit.audit_log`. The envelope therefore cannot
be used to re-derive credentials.

---

## 8. Audit of rights requests

- **Kafka audit events** (whitelist in `audit-events.ts`): `privacy.request.create`,
  `privacy.request.transition` — emitted via `emitAudit` → `dm.audit.log` with metadata
  `{ right_type, payload }` / `{ from, to }`. Payload metadata is REDACTED via
  `sanitizeMetadata` (sensitive keys scrubbed) before the wire.
- **Durability caveat**: `sendEvent` is gated on `KAFKA_URL` being set and does not fail
  the caller if Kafka is absent (`backend/src/events/kafka.ts`); the audit trail is **only
  as durable as Kafka availability**. Logged in code as intentionally non-fatal.
- **DB-level trail**: `compliance.privacy_requests` itself holds the definitive state
  (rows + `outcome`), so the rights workflow is auditable from Postgres even if the
  `dm.audit.log` consumer was down.

---

## 9. Rate limits, scope and operational limits

- **No rate limit is configured on any `/v1/privacy/*` route** (contrast: login and OTP
  routes define `config.rateLimit`). Repeated mass submissions by an authenticated user are
  not throttled — an operational gap to close (partial DoS / spam surface).
- Requests are always **subject-scoped** (`requester_id = auth sub`); list/get use `AND …`
  ownership predicates. Reviewer route is the only cross-subject read and is limited to
  `ADMIN`/`BILLING_ADMIN`.
- **No email verification** exists — a subject is authenticated solely by possession of
  credentials; this raises the question of account-recovery and request-authentication
  assurance (LEGAL REVIEW REQUIRED for identity-verification standards on DELETION).

---

## 10. Known gaps (summary)

| Gap | Status |
|---|---|
| No client UI/batch export for any privacy right (verified: zero app calls to `/v1/privacy/*`) | `PARTIAL` — backend `PASS`, user-facing `FAIL` |
| No email verification / verified contact channel for fulfilling responses | `PARTIAL` |
| No proactive breach-notification channel (see kenya-data-protection-assessment.md §2) | `FAIL` / `LEGAL REVIEW REQUIRED` |
| Erasure of `sessions.routing` not executed despite plan | `FAIL` (plan/impl drift) |
| No `deleted:` marker on retained financial UUID columns | `UNKNOWN` / `LEGAL REVIEW REQUIRED` |
| No rate limit on privacy endpoints | `PARTIAL` |
| CORRECTION application is operator-mediated, not automated write | `PARTIAL` (by design) |

The DSAR mechanism itself (endpoints, state machine, CAS guards, transaction-scoped
erasure, envelope construction, audit wiring) is `PASS` as a backend implementation.
End-to-end statutory compliance, identity-assurance standards, and the retained-UUID
policy require qualified counsel / ODPC confirmation.