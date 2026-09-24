# DRAVIO — Data Lifecycle Audit: Export (33) & Account Deletion (34)

Engineering audit of what a DRAVIO user can export, what account deletion actually
erases or retains, and whether the stored claim set matches the code. Evidence-cited;
this is a technical record, not a legal opinion.

Sources read: `backend/src/modules/privacy/**`, `backend/src/modules/compliance/pure/privacy-rights.ts`,
`backend/src/modules/compliance/repositories/privacy.repository.ts`, `backend/src/modules/audit/producer.ts`,
`backend/src/modules/audit/index.ts`, `backend/src/modules/compliance/pure/audit-events.ts`, `master_init.sql`,
`backend/migrations/001_hardening.sql`, `backend/migrations/002_compliance.sql`,
`docs/compliance/data-subject-rights-implementation.md`, `docs/compliance/FINAL_COMPLIANCE_REPORT.md`,
`docs/compliance/compliance-matrix.md`, `docs/policies/*`.

Status vocabulary: `OPEN` / `PARTIAL` / `MATCH` / `STALE-DOC` / `CLOSED`.

---

## 1. Data export (point 33)

### 1.1 What export machinery exists

There is **no dedicated export/download endpoint** (no CSV, JSON-file, ZIP, or `/export`
route anywhere in `backend`; grep for `export|csv|download|userData` returns only
unrelated modules). The only subject-facing "export" is the DSAR **ACCESS / PORTABILITY**
envelope, produced at reviewer time and stored in `compliance.privacy_requests.outcome`
JSONB, retrievable afterwards by the requester.

Flow that yields exportable data:

1. `POST /v1/privacy/requests` with `right_type: ACCESS` or `PORTABILITY`
   (`backend/src/modules/privacy/index.ts:16-52`).
2. Reviewer `POST /v1/privacy/requests/:id/review` `action=COMPLETED`
   (`backend/src/modules/privacy/index.ts:112-149`) — calls
   `privacyService.collectAccessEnvelope(requester_id)` for ACCESS **and** PORTABILITY
   (`privacy/index.ts:133-135`); the result is stored as `outcome.access_envelope`
   (`privacy/index.ts:141`; `privacy.repository.ts:55-73`).
3. Requester fetches it via `GET /v1/privacy/requests/:id`
   (`privacy/index.ts:73-84` via `findOwnedById`, `privacy.repository.ts:36-42`).

Both ACCESS and PORTABILITY resolve to the **identical JSON envelope**; nothing is turned
into a machine-readable "file", despite PORTABILITY being declared
`deliverable: 'file'` (`privacy-rights.ts:46`).

### 1.2 What the export envelope contains

Built by `collectAccessEnvelope` (`privacy.service.ts:14-77`):

| Section | Columns selected | Line |
|---|---|---|
| profile | email, full_name, kyc_level, country_code, phone_number, is_seller | 21-24 |
| linked_identity_providers | provider_name, provider_email, created_at | 27-31 |
| transactions | id, amount_usd, platform_fee_usd, seller_net_usd, currency, payment_method, status, created_at, updated_at | 34-39 |
| billing_sessions | id, status, bytes_used, cost_accumulated, started_at, ended_at | 42-47 |
| wallet | id, balance_usd, escrow_usd | 49-53 |
| ledger | amount_usd, transaction_type, reference, status, created_at | 55-60 |
| payouts | id, amount_usd, currency, status, created_at | 62-67 |
| seller_earnings | id, amount_usd, platform_fee_usd, status, created_at | 69-74 |

### 1.3 Leak checks on the export (verified against code)

- **No password material:** `auth.users.password_hash` is never selected (profile query
  reads only `users.profiles`); refresh-token rows/hashes (`auth.refresh_tokens`) never
  selected (`privacy.service.ts:20-24`, `27-31`).
- **No provider credential identity:** `auth.providers.provider_id` (the OAuth subject
  constant) is excluded (`privacy.service.ts:28`).
- **No session secrets:** `billing.sessions.session_token` excluded from the envelope
  (`privacy.service.ts:43`). (Note: the *non-DSAR* self-scoped routes
  `GET /v1/billing/sessions/active` and `/history` DO return the caller's own
  `session_token` — `wallet.routes.ts:156,176` — self-only, but an enlarged self-export
  surface.)
- **No other-user data:** every query is `WHERE … = $1` bound to the authenticated
  subject UUID; the envelope is delivered only through the ownership-scoped
  `findOwnedById` (`privacy.repository.ts:36-42`). The only cross-subject read is the
  reviewer route, gated `ADMIN`/`BILLING_ADMIN` (`privacy/index.ts:112`).
- **No internal secrets:** the query list contains no env, keys, or infra identifiers.

### 1.4 Right-type reality vs the task's "6 DSAR rights"

The code implements **5** right types, not 6 (`PRIVACY_RIGHTS`,
`privacy-rights.ts:5-11`): `ACCESS`, `CORRECTION`, `OBJECTION`, `DELETION`, `PORTABILITY`.
There is no separate `RESTRICT`/`EXPORT`/`COPY` right. Payload requirements:
`CORRECTION` requires a payload (whitelist `full_name`/`phone_number`/`country_code`,
`privacy-rights.ts:67-97`); `ACCESS`/`PORTABILITY`/`DELETION`/`OBJECTION` fulfill with no
payload. PORTABILITY is the only right whose profile promises a machine-readable
deliverable (`privacy-rights.ts:46`) and it is the only right that needs a *shaped export
artifact* — which today is not produced (D-02).

---

## 2. Account deletion — end-to-end trace (point 34)

### 2.1 Trace

1. **Request** — authenticated user posts `DELETION`; `canCreateRequest` refuses only
   `SYSTEM`/`SERVICE`/`ADMIN` roles (`privacy/index.ts:25-27`; `privacy-rights.ts:59-63`).
   No confirmation prompt, no re-authentication, no second factor, no email verification
   (documented as a gap in `data-subject-rights-implementation.md:162-164`).
2. **Authorization / confirmation** — the deletion executes only when a reviewer
   (`ADMIN`/`BILLING_ADMIN`) marks the request `COMPLETED`
   (`privacy/index.ts:112,129-132`). The actor is the reviewer; `requester_id` (the
   subject) is the deletion target (`privacy/index.ts:131`).
3. **Execution** — `applyDeletion(userId)` in a single transaction
   (`privacy.service.ts:84-130`): iterates `plan.erasable` and issues hard `DELETE`s,
   then rewrites one anonymization column, then COMMIT. Any error ROLLBACKs (all-or-nothing).
4. **Session revocation** — none (see D-08).
5. **Retained records** — financial/governance stores are untouched (see §3).
6. **Audit event** — one `privacy.request.transition` is emitted *after* the DB write
   (`privacy/index.ts:143`); no dedicated `account.deleted` action exists
   (`audit-events.ts:5-20`). `emitAudit` is best-effort: it swallows errors and depends on
   Kafka (`producer.ts:21-35`; `audit/index.ts:5-9`). The durable record is the
   `compliance.privacy_requests` row itself.

### 2.2 What DELETION actually deletes, per code

Executed hard deletes (`privacy.service.ts:91-112`), in this order:
`auth.providers` → `auth.refresh_tokens` → `users.profiles` → `billing.wallets` →
`auth.users`. Columns/FKs (`master_init.sql`): these child tables carry
`ON DELETE CASCADE` to `auth.users` (`master_init.sql:28,39,53`), so deleting the parent
is safe. **No retained table has a FK to `auth.users`** (only `provider_id`-type UUID
columns without `REFERENCES`; verified in `master_init.sql:69-95,125-143,150-161,244-253`
and both migrations), so the DELETE cannot fail on a retained row. `billing.wallets` is
deleted even when `balance_usd`/`escrow_usd` are non-zero — remaining funds are forfeited
with no guard and no payout option (D-07).

The single anonymization statement:
`UPDATE billing.sessions SET customer_id = 'deleted:'.$1 WHERE customer_id = $1`
(`privacy.service.ts:117-120`). That is the **only** row rewritten besides the deletes.

### 2.3 Comparison vs phase-35 docs

| Phase-35 claim (doc:line) | Code reality | Verdict |
|---|---|---|
| `sessions.routing` is "anonymizable → deleted marker" (`data-subject-rights-implementation.md:101,112-113`; `privacy-rights.ts:116-118`) | No table `sessions.routing` exists in any `.sql`. The routing data actually lives in Redis `session:*` JSON keys (24 h TTL, `session/index.ts:70-73,196-217`) and in `sessions.sessions` (defined `master_init.sql:150-161`, never written by code). `applyDeletion` touches neither. | `STALE-DOC` (phantom table in plan) |
| "Retained financial records … pseudonymous UUID" (`FINAL_COMPLIANCE_REPORT.md:55-60,172-173`; `data-subject-rights-implementation.md:110-116`) | Retained stores keep the **raw user UUID** in `user_id`/`seller_id`/`customer_id`; `billing.ledger_entries.user_id` is TEXT and unmarked (`001_hardening.sql:15`). No `deleted:` marker is applied to any retained column. Linkage is broken only by the absence of the identity join row. | `PARTIAL` |
| Doc lists erasure of identity rows (`data-subject-rights-implementation.md:106`) | True — the 5 deletes execute as listed. | `MATCH` |

The docs surface most of §3's retention honestly (e.g. `data-subject-rights-implementation.md:110-120`),
but **none of the phase-35 docs flag** D-07 (funds forfeiture), D-08 (no session
revocation), D-09 (DSAR-table PII copies), or D-10 (hardware_id drift).

---

## 3. Data-store map — what "deletion" does to every store

| Store (schema:line) | Key column | Deletion semantics per `applyDeletion` | Status |
|---|---|---|---|
| auth.users (`master_init.sql:16`) | id | hard DELETE | erased |
| auth.providers (`:26`) | user_id | hard DELETE (also FK-cascades) | erased |
| auth.refresh_tokens (`:37`) | user_id | hard DELETE (also FK-cascades) | erased |
| users.profiles (`:51`) | auth_user_id | hard DELETE (also FK-cascades) | erased |
| billing.wallets (`:102`) | customer_id TEXT | hard DELETE regardless of balance | erased; balance/escrow forfeited (D-07) |
| billing.sessions (`:112`) | customer_id TEXT, hardware_id, session_token | customer_id → `deleted:` marker only | partial-anonymized; hardware_id + session_token + status retained (D-10) |
| sessions.sessions (`:150`) | buyer_id, seller_id | untouched (plan names nonexistent `sessions.routing`) | retained raw UUID (D-06) |
| sessions.handoffs (`:164`) | session_id | untouched | retained |
| payments.transactions (`:69`) | user_id (no FK) | untouched | retained raw UUID |
| payments.payouts (`:87`) | seller_id | untouched | retained raw UUID |
| billing.invoices (`:125`) | customer_id UUID | untouched | retained raw UUID |
| billing.usage_records (`:137`) | customer_id | untouched | retained raw UUID |
| billing.ledger_entries (`001:13`) | user_id TEXT | untouched | retained raw UUID TEXT |
| billing.seller_earnings (`master_init.sql:244`) | seller_id | untouched | retained raw UUID |
| analytics.metrics (`:177`) | metric_name | untouched | retain (no personal identifiers) |
| analytics.session_telemetry (`:184`) | session_id | untouched | retain (no personal identifiers) |
| audit.audit_log (`:198`, `002:8`) | actor_id, metadata JSONB | untouched | retained by design; **metadata can contain user email/phone** (D-11) |
| compliance.privacy_requests (`002:32`) | requester_id, request_payload, outcome | **untouched, not in plan** | retained — holds a PII copy incl. the full access envelope (D-09) |
| compliance.policy_acceptances (`002:66`) | user_id, ip_address, user_agent | **untouched, not in plan** | retained PII (D-09) |
| compliance.provider_intake (`002:50`) | user_id, verification JSONB | **untouched, not in plan** | retained PII/business records (D-09) |
| compliance.retention_rules / sanctions_config (`002:83,117`) | — | untouught (config; no PII) | retain |
| Redis `session:*` (`session/index.ts:72`) | buyer_id/seller_id in JSON | untouched; 24 h TTL | retained transient (D-08) |
| Redis `seller:*` (marketplace heartbeat) | seller_id key | untouched; 300 s TTL | retained transient |

---

## 4. Findings

| ID | SEVERITY | EVIDENCE (file:line) | IMPACT | FIX | STATUS |
|---|---|---|---|---|---|
| D-01 | HIGH | No export endpoint anywhere; only DSAR envelope path `privacy/index.ts:33-47,73-84,133-135`; grep `export/csv/download` empty | A user has no direct way to download or receive a portable copy of their data; PORTABILITY promised as `deliverable:'file'` but no file artifact is produced | Implement a shaped, machine-readable export (JSON/CSV) surfaced through a user-facing endpoint and app flow; emit export from the existing envelope | OPEN |
| D-02 | HIGH | `privacy-rights.ts:46` (`PORTABILITY` deliverable `'file'`); `privacy/index.ts:133-135` feeds ACCESS and PORTABILITY the same in-memory envelope | PORTABILITY is not meaningfully distinct from ACCESS; fails portability format expectations | Generate a bounded JSON/CSV export (single-user, matched-format) for PORTABILITY | OPEN |
| D-03 | INFO | `privacy-rights.ts:5-11` | Task frame assumes 6 rights; code implements 5 (no RESTRICT/EXPORT). ACCESS/CORRECTION are automated; DELETION/OBJECTION require reviewer (`privacy-rights.ts:41-47`) | Reconcile any doc/task listing "6" rights to the implemented 5 (or add the sixth) | MATCH |
| D-04 | LOW | `privacy.service.ts:14-77` | Envelope excludes password_hash, refresh tokens, provider_id, session_token, env secrets — verified, no credential/PII-of-others leak in the export | No change needed; add regression tests asserting these exclusions | CLOSED |
| D-05 | LOW | Self-scoping: `privacy.repository.ts:36-51`; reviewer route `privacy/index.ts:112` | Envelope can reach only the requester (ownership-guarded GET); cross-subject read requires ADMIN/BILLING_ADMIN | Keep; add test for cross-user GET → 404 | MATCH |
| D-06 | HIGH | `master_init.sql:150-161`; `privacy.service.ts:117-120`; `privacy-rights.ts:116-118` | Plan names `sessions.routing` (does not exist) and never anonymizes real routing records (`sessions.sessions` raw buyer_id/seller_id, Redis `session:*` with buyer UUID) | Rewrite plan to name real stores and pseudonymize routing records and Redis keys on deletion | OPEN |
| D-07 | HIGH | `privacy.service.ts:105-107` (wallet DELETE), `master_init.sql:102-109` | Deleting `billing.wallets` destroys non-zero balance/escrow with no guard, no payout, no confirmation | Block/flag deletion when balance>0 or escrow>0, or route balance to payout first | OPEN |
| D-08 | HIGH | No revocation in `applyDeletion` (`privacy.service.ts:84-130`); access token TTL `auth/index.ts:11`; Redis sessions `session/index.ts:70-73`; relay termination only via admin cmd | Deleted account's **active session keeps running** (billing.sessions stays ACTIVE with `deleted:` customer), relay keeps serving it; Redis routing keys survive up to 24 h; access JWT valid up to 900 s post-deletion | Terminate active sessions, purge/expire Redis session keys, invalidate JWTs (token version or deny-list) at deletion | OPEN |
| D-09 | CRITICAL | `privacy-rights.ts:102-132` (plan has no compliance.*); `002_compliance.sql:32-75`; envelope stored `privacy.repository.ts:55-73` | DSAR tables retain full PII copies: `privacy_requests` (payload + full access envelope incl. phone), `policy_acceptances` (user, IP, UA), `provider_intake` (verification JSON: legal name, business reg., attached business record). "Deletion" leaves these intact | Add erasable/anonymizable entries for the three compliance tables (or shred payloads/outcomes/verification on delete) | OPEN |
| D-10 | MEDIUM | Comment `privacy-rights.ts:117` promises `customer_id + hardware_id → DELETED marker`; code rewrites only `customer_id` (`privacy.service.ts:118`) | `billing.sessions.hardware_id` (a persistent device UUID) survives delete, contradicting the plan comment | Rewrite hardware_id on deletion; align comment and code | OPEN |
| D-11 | MEDIUM | `audit-events.ts:33-54` redacts only token/password-style keys; `privacy/index.ts:45` logs `payload` (CORRECTION contains phone_number); `auth/index.ts:47` logs `email`; `audit/index.ts:18-22` writes metadata; retention 36500 d (`retention.ts:144-151`) | Phone number / email persist in audit metadata for ~100 years after "deletion" (governance log plus PII). May be defensible but contradicts "identity erased" claims | Extend `sanitizeMetadata` to scrub phone_number/email/full_name; document deliberate audit-PII decision | PARTIAL |
| D-12 | MEDIUM | No `account.deleted` in `AUDIT_ACTIONS` (`audit-events.ts:5-20`); event emitted after commit (`privacy/index.ts:143`); Kafka-optional (`producer.ts:21-35`, `audit/index.ts:15-27`) | Deletion trail is implicit (transition event + DB row), and vanishes if Kafka is absent | Emit `account.deleted`; persist a durable local audit fallback | OPEN |
| D-13 | LOW | Retained stores keep raw UUIDs with no FK enforcement (`master_init.sql` passim) | Post-deletion data is inert (no join row) but the UUID copies remain — legal-adequacy question, already flagged `FINAL_COMPLIANCE_REPORT.md:55-60` | Counsel review; consider hashed/`deleted:` identifiers in retained columns | PARTIAL |
| D-14 | LOW | Reviewer-gated deletion (`privacy/index.ts:112`), CAS transitions (`privacy.repository.ts:55-73`), transaction-scoped erasure (`privacy.service.ts:86-128`) | Erasure itself executes all-or-nothing; state machine is sound | Keep; add tests proving rollback on mid-plan failure | MATCH |
| D-15 | INFO | No rate limit on `/v1/privacy/*` (contrast login/OTP `auth/index.ts:70,137,157`) | Spam/DoS surface on DSAR endpoints | Add `config.rateLimit` to privacy routes | OPEN |
| D-16 | LOW | Envelope outcome persists in `privacy_requests.outcome` for the lifetime of the row | The exported copy is itself a retained PII store; see D-09 | TTL or shred `outcome` after delivery | OPEN |
| D-17 | INFO | `apps` grep finds zero calls to `/v1/privacy/*`; only static screens (`apps/mobile-app/src/screens/Legal.tsx`, `apps/buyer-web/src/app/privacy/page.tsx`) | Users cannot trigger export or deletion from any shipped app; app-store account-deletion obligations unmet (see policy audit) | Wire DSAR create/fulfillment into mobile + buyer-web | BLOCKED |