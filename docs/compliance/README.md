# DRAVIO Compliance Documentation

Engineering-grounded compliance/legal assessments for the DRAVIO marketplace codebase.
All documents are **facts-only technical records** grounded in the repository (`master_init.sql`,
`backend/migrations/*`, `backend/src/modules/...`, `apps/...`). The `LEGAL ANALYSIS` and
`REQUIRES COUNSEL` sections raise open questions; they assert no legal answers, registrations,
licenses, deadlines, or compliance certifications.

Statuses used throughout: `PASS` / `PARTIAL` / `FAIL` / `NOT APPLICABLE` / `UNKNOWN` /
`LEGAL REVIEW REQUIRED` / `BLOCKED`.

## Documents

1. [kenya-data-protection-assessment.md](kenya-data-protection-assessment.md) — Kenya DPA 2019 assessment: full personal-data field inventory (column → purpose → basis → retention → storage → sharing → notes), control-by-control status, identified legal questions, and authoritative sources (DPA 2019 Act No. 24).

2. [data-subject-rights-implementation.md](data-subject-rights-implementation.md) — The implemented DSAR workflow: endpoints, state machine (PENDING/IN_REVIEW/COMPLETED/REJECTED/WITHDRAWN), reviewer requirements, the real deletion/pseudonymization plan, access-envelope contents, audit wiring, rate-limit gap, and known gaps.

3. [cross-border-data-flow.md](cross-border-data-flow.md) — Actual data flows with a Mermaid diagram: device→API, Stripe hosted checkout (no card data on DRAVIO), M-Pesa Daraja, Postgres/Redis/Kafka, OAuth providers, Twilio/Cloudinary/Firebase (env-gated); transfer-outside-Kenya status marked per flow.

4. [kenya-communications-regulatory-assessment.md](kenya-communications-regulatory-assessment.md) — Preliminary Kenya CA/KCA classification of marketplace activities into four buckets (LIKELY REQUIRED / POSSIBLY REQUIRED / NOT IDENTIFIED / REQUIRES LEGAL/CA CONFIRMATION); explicitly not a legal conclusion, CA confirmation required.

5. [payment-security-scope.md](payment-security-scope.md) — Payment security scope: card data never enters DRAVIO (Stripe hosted checkout), PCI SAQ guidance flagged LEGAL REVIEW REQUIRED, M-Pesa STK/callback/5-KES reconciliation, transaction-state-machine layering, wallet/escrow semantics, and payouts marked BLOCKED.

6. [aml-kyc-assessment.md](aml-kyc-assessment.md) — AML/KYC: no KYC pipeline (kyc_level vestigial), no monitoring thresholds, configurable-only sanctions gate (empty by default), payouts non-functional (BLOCKED / PROVIDER CAPABILITY REQUIRED), honest money-laundering risk register, and explicit statement that DRAVIO computes no taxes.

## Conventions

- A control passes only if implemented and verifiable in the code. Prose/intent is never treated as a control.
- Legal interpretations appear only as open questions requiring qualified counsel / ODPC / CA confirmation; no outcomes or deadlines are fabricated.
- Exact table/column names and API endpoints are used as implemented; schemas: `auth.*`, `users.*`, `payments.*`, `billing.*`, `sessions.*`, `analytics.*`, `audit.*`, `compliance.*`.