# Security Policy

DRAVIO's security handling is governed by the documents in `docs/security/`.
This file is the entry point for **reporting** and for stating what is supported.

**Stack-rank for the canonical security target**: GitHub-native private advisories
(vulnerability report → `docs/security/vulnerability-management.md`) is the preferred
channel; this repo-root `SECURITY.md` is the on-disk fallback so the triage path
survives without GitHub. If neither exists for your fork, report through
`docs/security/` directly.

## Supported versions

| Component | Version base | Reference |
|---|---|---|
| Backend (`@dravio/backend`) | `1.0.0` | `backend/package.json` |
| DRAVIO root workspace | `1.0.0` (monorepo) | `package.json` |
| Node runtime | `>=20.0.0` required | `package.json` / `backend/package.json` engines |

Only the **latest** release of each component is supported. No legacy-branch security
fixes are provided unless a component is explicitly declared here.

## Reporting a vulnerability

**Do not open a public GitHub issue. Submit a private report.**

1. **Preferred:** GitHub **Security → Report a vulnerability** (private advisory)
   scoped to this repository. Do **not** attach payloads/keys; describe them.
2. **Fallback:** file the finding directly into the tracking process:
   - Add a row to `docs/security/risk-register.md` (following its rule: every row
     needs a source doc + line evidence), or
   - If you cannot edit the repo, email the details to the platform operator and
     reference `docs/security/vulnerability-management.md` so it enters the register.

**What to include in a report:**
- Component, endpoint/file, version, and steps to reproduce
- Impact (data exposure, money movement, availability, store-policy)
- Suggested fix (if known); **do not include** live secrets, tokens, or full payload dumps
- Whether it is already public and when

After a report is accepted it is logged to `docs/security/risk-register.md` and triaged
per `docs/security/vulnerability-management.md` (statuses `REPORTED → TRIAGED → FIXED →
FIXED-VERIFIED`), with fixes verified by regression evidence — never by the fixer alone.

## Remediation SLAs

Applied at triage; source of the mapping: `docs/security/vulnerability-management.md`
§1 (severity → tier → window). A row is `BLOCKED` and the SLA pauses only while a
tracked dependency blocks it (e.g. live infra, vendor onboarding).

| Register severity | Tier | Fix window (from REPORTED) |
|---|---|---|
| CRITICAL / RED | P0 | **24 hours** (fix or containment) |
| HIGH / FAILED(security) | P1 | **7 days** |
| MEDIUM / MODERATE / PARTIAL | P2 | **30 days** |
| LOW / INFO / N/A / MATCH | P3 | Next quarterly cycle |
| LEGAL REVIEW REQUIRED / UNKNOWN | Counsel | No fix SLA until a determination exists |
| BLOCKED | BLOCKED | SLA pauses; dependency is tracked as its own register row |

**Current known posture** (2026-09-24 baseline): see `docs/security/risk-register.md`
— no value is claimed as "verified" unless a source doc records a verification step.
Top open P0/P1 items are tracked there.

## Safe harbor

DRAVIO considers coordinated, good-faith security research conducted under this policy
to be authorized: research is limited to the **authorized scope** in
`docs/security/pentest-scope.md`; controlled, non-destructive testing only; no data
exfiltration, no denial-of-service beyond what the scope allows, and no access to other
users' data. Researchers who act within the scope will not be pursued for those
activities. Out-of-scope or destructive activity is not safe harbored.

## Coordinated disclosure

We coordinate on confirmed issues: fixes are tracked to `FIXED-VERIFIED` before any
public disclosure, and CVEs are filed through the vulnerability-management process
once a fix is landed. We never publish premature or unverified claims (this follows
`vulnerability-management.md` §4 reintroduction-prevention rules).

## Incident response

If you believe an incident is **already in progress** (unauthorized money movement,
suspected data exposure at scale), follow `docs/security/incident-response-plan.md`
(SEV-1 → page on-call; suspected personal-data breach is at least SEV-2). The plan is a
working draft with placeholder contacts that must be filled before it is carried —
do not rely on unset names.

## Related documents

- `docs/security/risk-register.md` — evidence-traced register (R-001…R-200)
- `docs/security/vulnerability-management.md` — severity → SLA mapping, triage loop, keeper rule
- `docs/security/incident-response-plan.md` — severity levels and containment runbook
- `docs/security/pentest-scope.md` — authorized scope for penetration testing
- `docs/compliance/` — data-protection, AML/KYC, payment-security assessments