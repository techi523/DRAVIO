# DRAVIO Incident Response Plan

- **owner:** Platform Engineering / Security (assign on-call per roster below)
- **status:** Working draft — sign-off pending
- **review cadence:** quarterly, plus after every drill or real incident
- **related documents:** `docs/threat-model.md`, `docs/security-architecture.md`, `docs/disaster-recovery.md`, `docs/compliance/kenya-data-protection-assessment.md`

> This document is DRAVIO's internal operational plan. It is not legal advice and does not claim statutory compliance. Applicability of specific laws requires qualified counsel. Where this plan references legal timelines or statutory obligations, they are the subject of legal review and are marked as such; no timeline is asserted here without that review.

## 1. Scope

This plan governs response to security and availability incidents affecting the DRAVIO platform: backend API, database, Redis marketplace store, Kafka event pipelines, payment processing (Stripe, M-Pesa), seller relay infrastructure, and the buyer/seller/in-app surfaces. It covers technical response and the data-handling steps taken when personal data may be affected.

## 2. Roles and on-call contacts

All placeholders must be filled in by the platform operator; this file must not ship with fake identities.

| Role | Responsibility | Primary | Escalation |
| --- | --- | --- | --- |
| Incident commander (IC) | Runs the response, owns the timeline | `<PLACEHOLDER: engineer on rotation>` | `<PLACEHOLDER: platform lead>` |
| Security / containment | Root cause, evidence preservation, containment execution | `<PLACEHOLDER: security engineer>` | `<PLACEHOLDER: security lead>` |
| Billing administrator | Money movement decisions (refunds, reversals, cancellation), transaction states | `<PLACEHOLDER: billing admin>` | `<PLACEHOLDER: head of operations>` |
| Privacy / DSAR reviewer | Data-subject notices, deletion/access fulfillment | `<PLACEHOLDER: DPO/reviewer>` | `<PLACEHOLDER: legal>` |
| Legal / external counsel | Breach notification, statutory assessment | `<PLACEHOLDER: counsel>` | — |
| Communications | Internal + user-facing communications drafting | `<PLACEHOLDER: comms>` | IC |

On-call roster and escalation tree: `<PLACEHOLDER: link to roster>`. Out-of-hours bridge: `<PLACEHOLDER: bridge/dial-in>`.

## 3. Severity levels

| Level | Definition | Examples | Target initial response |
| --- | --- | --- | --- |
| SEV-1 | Active data exposure, unauthorized money movement, or full platform outage. | Access-token compromise at scale; wallet/ledger tampering; DB or Kafka credit compromised; total API outage. | Immediate; page on-call. |
| SEV-2 | Significant degradation or suspected breach not yet confirmed. | Suspicious webhook/spoofing attempts, partial session disruption, anomalous payout or dispute activity (note: payouts are not yet functional). | < 1 business day. |
| SEV-3 | Minor anomaly, no confirmed impact. | Heartbeat spike, isolated 5xx, rate-limit saturation of a single client. | < 1 business day. |
| SEV-4 | Process gap or cosmetic issue found in review. | Missing log fields, stale doc. | Next sprint. |

The severity may be raised at any point. A suspected personal-data breach is treated as at least SEV-2 until legal review concludes otherwise.

## 4. Response phases

### 4.1 Prepare

- Keep the on-call roster and escalation tree current (section 2).
- Keep runbook commands (section 8) access-restricted and tested in staging.
- Ensure billing-administrator and administrator roles are provisioned per the seed/CLI process, never via public APIs (roles on public accounts are only the self-selectable `BUYER`/`SELLER`).
- Confirm the audit pipeline is healthy: Kafka topic `dm.audit.log` must be consumed into `audit.audit_log`. This is the primary record for reconstruction after an incident.
- Maintain the Kenya compliance assessment in `docs/compliance/kenya-data-protection-assessment.md`; this plan's breach steps assume it exists and is current. If it is missing or stale, note it as a pre-existing gap in the after-action report.

### 4.2 Identify

- Collect the monitoring signals that exist today (section 5).
- Determine blast radius: which accounts, transactions, sessions, and data categories are affected.
- Preserve evidence before any destructive action (see contain). Do not modify `audit.audit_log` rows; it is append-only governance data.
- If personal data is involved, classify the data categories against the Privacy Policy (`privacy`) and the retention registry (`GET /v1/compliance/retention`) so the legal assessment can be scoped.

### 4.3 Contain

- Stop the bleeding before root-causing. Use the runbook (section 8): revoke tokens, suspend accounts, deactivate listings, terminate sessions, escalate money movement to a billing administrator.
- Do not delete evidence. Trade a small availability impact (e.g., suspending a seller, rate-limiting a range) over destroying logs, audit rows, or transaction state.
- Isolate the affected component: the marketplace Redis store, the PostgreSQL database, the Kafka broker, or a specific relay listing.

### 4.4 Eradicate

- Remove the root cause (revoked credentials, patched input validation, removed malicious listing/heartbeat, corrected configuration).
- Rotate secrets that may have been exposed (JWT secret, Stripe secret/webhook keys, DB credentials), and rotate rather than reuse.
- For confirmed data-breach cases, follow the breach-handling steps in section 7 before and during eradication.

### 4.5 Recover

- Restore services from known-good state; `docs/disaster-recovery.md` governs database/state recovery.
- Verify recovery of state machines: transaction states must be consistent (see `backend/src/modules/payment/core/transaction-machine.ts`); disputed/refunded/reversed transitions are billing-admin actions and must be re-applied through the API so they are audited and reason-tagged.
- Verify re-establishment of the audit consumer and the analytics aggregator, and that new events flow from `dm.audit.log` into `audit.audit_log`.

### 4.6 Lessons learned

- Hold a post-incident review within a bounded window; produce an after-action report with root cause, timeline, actions, and recommendations.
- File follow-ups for every gap (e.g., log shipping, missing billing-admin coverage) and track them to closure.

## 5. Monitoring signals available today

These are the real, currently-operational telemetry sources. No source is claimed that does not exist.

| Signal | Source | Notes |
| --- | --- | --- |
| Request logs | Fastify (pino) structured logs configured in `backend/src/index.ts` (level `info` in production). | Developer-visible; not shipped to a central log platform today. |
| Audit trail | Events published to Kafka topic `dm.audit.log` (`backend/src/modules/audit/producer.ts`) and consumed into `audit.audit_log` (`backend/src/modules/audit/index.ts`). | Governance log: policy acceptances, payment transitions, privacy requests, provider intake, DSAR reviews. Best source of truth for reconstruction. |
| Business aggregates | `analytics.metrics` (`total_sessions`, `total_revenue`) aggregated from `dm.session.completed` and `dm.payment.completed` (`backend/src/modules/analytics/index.ts`). | Coarse counters; useful for anomaly detection only. |
| Marketplace store | Redis `seller:*` hashes + `active_sellers_geo` (heartbeats, statuses, TTL 300s). | Confirms which listings are live and their pricing/relay state. |
| Payment callbacks | Stripe webhook + M-Pesa callback endpoints (`backend/src/modules/payment/index.ts`). | Both are replay-safe and signature-checked; look for unexpected callbacks or amount mismatches. |

### Known observability gaps (immediate)

- There is no log shipping, central log aggregation, or SIEM; detection depends on manual inspection of pino logs and the database.
- No alerting/notification integration exists out of the box (no paging on SEV conditions).
- `analytics.metrics` counts are coarse; there is no per-seller or per-session anomaly detection at present.

## 6. Data breach handling

1. **Confirm/contain first** (section 4.3), preserving evidence.
2. **Scope the data**: determine which categories of personal data were exposed against the Privacy Policy (`privacy`) and the retention registry. Do not assume only the obvious table was affected; audit events may reveal the full surface.
3. **Notify the reviewer/DPO and legal** at once, per the roster. All notifications and customer communications go through legal and communications; no engineer or support agent should issue breach communications directly.
4. **Assessment**: the applicability of Kenya's data-protection framework and any notification obligations are assessed against `docs/compliance/kenya-data-protection-assessment.md`. Also note that the application of Kenya's consumer (CA) protection rules to this marketplace is currently unresolved and must not be asserted in communications.
5. **Notification timeline**: `LEGAL REVIEW REQUIRED` — this plan deliberately does not state a number of days for breach notification. No timeframe may be communicated to users or authorities until counsel has determined the applicable requirement on the specific facts.
6. **DSAR/rights**: affected users may raise `ACCESS`, `DELETION`, and other rights requests at `POST /v1/privacy/requests`. These require the reviewer/DPO role (`POST /v1/privacy/requests/:id/review`), which must be provisioned before an incident needs it.
7. **Record**: every step (identification, containment commands, data classification, notifications sent) goes into the incident log and, where appropriate, into the audit trail.

## 7. Testing the plan

- **Tabletop (quarterly)**: run a scenario end to end on paper, e.g., "a Stripe webhook replay reveals a duplicated credit" or "seller relay exposed in listings is hijacked". Check that on-call roles are reachable and that no runbook command touches `audit.audit_log`.
- **Simulated containment (twice a year)**: in staging, execute section-8 runbook commands against synthetic accounts — revoke tokens, suspend a seller, terminate a session, and run a billing-admin refund transition — and confirm the audit events land in `audit.audit_log`.
- **Drill data**: seed a fake incident (abnormal heartbeat volume, anomalous dispute rate) and verify an operator can find the signal in pino logs and `analytics.metrics`.
- **After each drill**: record time-to-detect and time-to-contain, file gaps, and update this plan. Drills are also the place to test for a reviewer/DPO whose DSAR role has actually been provisioned.

## 8. Runbook (concrete containment commands and endpoints)

Authorized responders only. In staging first unless SEV-1.

### Revoke access tokens and sessions

- Revoke all refresh tokens for a user:
  - `UPDATE auth.refresh_tokens SET revoked = TRUE WHERE user_id = '<UUID>' AND revoked = FALSE;`
  - Or via admin API: `POST /v1/admin/users/:id/revoke-tokens` (dispatches `revoke_tokens` on `dm.admin.command`; `backend/src/modules/admin/api/soc.controller.ts`).
- Revoke by raw token (logout path): `POST /v1/auth/logout` with the refresh token; backend implements `revokeRefreshToken` (`backend/src/modules/auth/repositories/auth.repository.ts:102`).
- Access JWTs are short-lived; revoking refresh tokens prevents new sessions. Actual geofencing of JWTs is not implemented — plan revocation as the token control.

### Suspend a user

- `POST /v1/admin/users/:id/suspend` (dispatches `suspend` on `dm.admin.command`; `backend/src/modules/admin/api/users.controller.ts`).
- Direct SQL fallback is to flip the profile flag and, if needed, the `auth.users.roles` array — but only where the admin API has already run; do not mutate roles ad hoc. Note: admin roles are provisioned via seed/CLI only.

### Deactivate a seller listing (marketplace)

- Immediate visibility removal (staging/prod Redis): mark offline and remove geo membership:
  - `HSET seller:<id> status offline` then `ZREM active_sellers_geo <id>` — equivalent Redis commands apply to the geo set used by `marketplace.repository`.
  - Listings without a real positive price were never offered; after deactivation the heartbeat will re-register on the next beat unless the seller is suspended. Combine listing removal with user suspension (`/suspend`) to fully stop a seller.
- Session termination for abusive active sessions: `POST /v1/admin/session/:id/terminate` (`backend/src/modules/admin/api/network.controller.ts`); sellers can also suspend sessions on their side.

### Rate limiting

- Global limiter: `@fastify/rate-limit`, `max: 200` per minute per client (`backend/src/index.ts:73`). To tighten during an attack, lower the limit at the reverse proxy or restart with a more restrictive time window; there is no per-user override endpoint today.

### Money embargo and refunds (BILLING_ADMIN only)

- Escalate to a billing administrator; money moves only through them:
  - `POST /v1/payments/:id/status` with `action` of `REFUND`, `PARTIAL_REFUND`, `REVERSE`, or `CANCEL` and a required `reason` (`backend/src/modules/payment/index.ts:170`; state machine + reasons in `backend/src/modules/payment/core/transaction-machine.ts`).
- Disputes are opened only by the transaction owner on a paid/fulfilled transaction: `POST /v1/payments/:id/dispute` with a reason.
- Every transition is CAS-guarded and audited (`POST /v1/payments/:id/history` for the trail).

### Payment and provider intervention points

- Wallet top-ups only credit from verified payments (Stripe webhook with signature check at `POST /v1/payments/webhook`; M-Pesa callback at `POST /v1/payments/mpesa/callback`). A suspected forged callback should be treated as SEV-1 and the webhook secret rotated.
- Payouts: `POST /v1/billing/withdraw` only writes a `PENDING` payout row and debits ledger balance; there is no money transfer to reverse. During an incident, treat `payments.payouts` rows as request records only and escalate any anomaly.

### Evidence preservation

- Do not delete or UPDATE `audit.audit_log`; read-only queries (`SELECT ... WHERE actor_id/action/...`) are the evidence path.
- Snapshot `analytics.metrics`, `payments.transactions`, `billing.ledger_entries`, and the marketplace Redis store before any destructive containment.

### Communication and legal checkpoints

- Before any user-facing or authority communication: legal review (section 6).
- After containment: file the incident record, update this plan, and address the log-shipping gap that limited visibility.

---

> This document is DRAVIO's internal operational plan. It is not legal advice and does not claim statutory compliance. Applicability of specific laws requires qualified counsel.