# DRAVIO — Compliance Change Monitoring

**Purpose:** track external legal / regulatory / platform / provider changes that can
change DRAVIO's compliance posture, and record what DRAVIO must do in response.

**Basis:** grounded in the on-disk compliance package — `docs/compliance/README.md`,
`compliance-matrix.md` (27 PASS / 11 PARTIAL / 6 FAIL / 1 BLOCKED / 1 UNKNOWN /
4 LEGAL REVIEW REQUIRED / 1 NOT APPLICABLE), `FINAL_COMPLIANCE_REPORT.md`
(10 open legal questions), `kenya-data-protection-assessment.md`,
`kenya-communications-regulatory-assessment.md`, `payment-security-scope.md`,
`aml-kyc-assessment.md`, `data-subject-rights-implementation.md`,
`cross-border-data-flow.md` — plus `docs/security/policy-integrity.md` and
`docs/security/risk-register.md`.

**Statuses used (and only these, in this document):**

| Status | Meaning |
|---|---|
| `BLOCKED` | Cannot proceed until a dependency fires (vendor, infra, agency response) |
| `LEGAL REVIEW REQUIRED` | Needs a counsel / regulator determination before any action |
| `HOLD-ON` | Under observation; no action taken yet |
| `IN-PROGRESS` | Being actioned; owner + target date recorded |
| `RESOLVED/IMPLEMENTED` | Action completed and evidenced |
| `ACCEPTED-TRACKED` | Specialist decision made to accept the change and track exposure |
| `WAITING-ON-3RD-PARTY` | Blocked on a vendor/regulator that must respond first |
| `NOT-APPLICABLE` | Change verified as not affecting DRAVIO's posture |
| `NO-LONGER-APPLICABLE` | Event resolved out before it applied |
| `VERIFIED` | Change monitored and the posture re-checked against source docs |

Status values are tracked in `risk-register.md` when the change creates or changes a
register row; this document is the "watch list", the register is the ledger.

## 1. Sources to watch (WHO / WHEN)

| Source | What to watch | Who | When |
|---|---|---|---|
| ODPC (Data Protection Commissioner Kenya) | DPA 2019 Regulations amendments, registration/dpo guidance, breach-notification guidance | `counsel` + `prod-ops` | quarterly; after any ODPC publication |
| Communications Authority of Kenya (CA) | Info-Communications Act / licensing / consumer-protection / tariff rules | `counsel` | quarterly; on press-releases about licensing categories |
| Central Bank of Kenya / POCAMLA | Payment-wallet, FX, AML reporting-institution rules | `counsel` | quarterly; on CBK circulars |
| Apple App Store Review Guidelines | 5.1.1(v) deletion, Data Practices, any 2026+ policy changes | `team` (mobile) + `counsel` | quarterly and before each submission |
| Google Play Policy / Data Safety | Data-deletion requirements, deceptive-behavior, permissions policies | `team` (mobile) | quarterly and before each submission |
| Stripe / Safaricom Daraja | Integrator terms, M-Pesa API deprecations, PCI SAQ changes | `prod-ops` | quarterly; on provider changelogs |
| Twilio / OAuth providers / Cloudinary / Firebase | ToS changes, data-residency, API deprecations | `prod-ops` | quarterly; on provider changelogs |
| PCI SSC | SAQ versioning changes → PCI scope determination | `counsel` + `prod-ops` | on DSS revision |

All of the above are **sources of change**, not conclusions. No change below is
asserted as a legal obligation; each is highlighted for review.

## 2. The registry when a change lands

1. **Detect** the change (from the sources above) and note the effective date.
2. **Assess impact** against `compliance-matrix.md`, `FINAL_COMPLIANCE_REPORT.md`,
   the Kenya assessments, and the attribution docs by matching the change to the 
   control it touches (by control ID or legal question).
3. **Action** in the required order:
   - if a legal question is open first (matrix status `LEGAL REVIEW REQUIRED`),
     route to `counsel` before any engineering change;
   - otherwise tag the register row (link to the change, add/update row);
4. **Record** the row here with the source, change, impact, action, status, and owner.
5. **Verify** next cycle — confirm the impact assessment was right, and that no
   existing row went stale (re-check this list against the register's latest rows).

None of the rows below claim a legal determination; each is a tracking entry.

## 3. Change watch-table

| SOURCE | CHANGE | IMPACT | ACTION | STATUS |
|---|---|---|---|---|
| CA Kenya licensing | Hotspot / internet resale via marketplace (`kenya-communications-regulatory-assessment.md:2.1`) | **LIKELY REQUIRED** bucket — no CA confirmation on record; who is "the operator" is open | Route to counsel + CA confirmation; do not assert "no license needed" | `LEGAL REVIEW REQUIRED` |
| CA Kenya / Info-Communications Act | DRAVIO aggregated third-party connectivity (2.2, 2.3, 2.7) | **POSSIBLY REQUIRED** buckets; data-resale question open | Same as above; re-classify when CA responds | `LEGAL REVIEW REQUIRED` |
| Kenya DPA 2019 / ODPC | Any change to registration / DPO / breach-notification guidance (FINAL_COMPLIANCE_REPORT.md question 1, 9) | ODPC registration + DPO + 72h-style timeline unknown | Counsel determination; keep no-timeline posture until then (incident-response-plan.md:104) | `LEGAL REVIEW REQUIRED` |
| ODPC / Kenya data-protection regime | Any change touching DSAR erasure adequacy for retained financial rows holding raw user UUIDs (questions 3, 6) | Erasure plan incomplete for `payments.transactions`, `billing.ledger_entries`, `billing.seller_earnings`, `payments.payouts`, `sessions.sessions` | Track `data-lifecycle-audit.md` D-06…D-13 + register R-085…R-088 | `LEGAL REVIEW REQUIRED` |
| ODPC cross-border regime | Transfers to Stripe/Twilio/OAuth/Cloudinary/Firebase (FINAL question 5; D-10 `UNKNOWN`) | No processor geo / transfer agreements in repo | Contract-level DPAs + transfer assessment | `WAITING-ON-3RD-PARTY` |
| Kenya CA consumer-protection | Tariff transparency & truthful payout promises (2.5) | Fee disclosure is API-only; payout is rows-only (`P-27` false claim) | Wire fee-breakdown UI; remove fabricated timeline from Terms; register R-108, R-107 | `IN-PROGRESS` |
| POCAMLA / CBK | Reporting-institution classification of pre-funded-wallet marketplace (FINAL question 6) | No monitoring thresholds; KYC vestigial (`FAIL`) | Counsel classification before any AML framework | `LEGAL REVIEW REQUIRED` |
| CBK / FX | Static USD/KES FX for settlement (P-20 `PARTIAL`) | FX legality + approach open (FINAL question 7) | Counsel + FX-source decision | `LEGAL REVIEW REQUIRED` |
| Stripe | SAQ-eligibility / integrator-terms changes (payment-security-scope.md) | Card data never enters DRAVIO, but PCI scope is contract-dependent (SAQ `LEGAL REVIEW REQUIRED`) | Re-validate with QSA on any DSS change | `WAITING-ON-3RD-PARTY` |
| Safaricom Daraja | M-Pesa API deprecations / sandbox→prod requirements (P-18 `PARTIAL`) | `MPESA_ENV` defaults sandbox; sandbox base-URL fallback still present | Force `MPESA_ENV=production`; remove sandbox fallback | `BLOCKED` |
| Apple App Store | 5.1.1(v) account-deletion enforcement | No in-app deletion path exists (M-12) | In-app deletion + hosted fallback; app-store-readiness.md | `BLOCKED` |
| Google Play / Data Safety | Data-deletion + data-category declaration requirements | No app deletion/export flow; device-ID disclosure inaccurate (M-19) | Ship deletion/export; correct Data Safety; app-store-readiness.md | `BLOCKED` |
| PCI SSC | DSS revision re-scoping SAQs | DRAVIO CDE posture | QSA re-check by PSP | `NOT-APPLICABLE` (until provider terms change) |

## 4. Cadence

- **Quarterly deep-check** (with the security quarterly bore): review source list §1,
  confirm the watch-table, and flag any change whose impact is not yet recorded.
  Trailing verification is a required step (§2.5) — re-run the impact keyword match
  so no row goes stale.
- **On-release review:** before each app-store submission and each payment-provider
  change, revalidate the mobile/payments rows in §3.
- **After a policy/text change** in `docs/policies/*`: re-run `policy-integrity.md`
  P-row checks so the new text does not fabricate behavior (MISMATCH rows R-098…R-111).
- **After any counsel/CA/OPDC determination:** update the matching rows, move status
  to `RESOLVED/IMPLEMENTED`, and mirror the change in `risk-register.md`.

## 5. Cross-links

- Register rows for the tail of this watch-list are tracked in `risk-register.md`
  (e.g. R-114 lawful basis, R-117 cross-border, R-118 breach notification,
  R-119 ODPC/DPO, R-123 payouts `BLOCKED`, R-128 sanctions,
  R-131 PCI SAQ, R-132 CA/AML classification).
- Legal posture: `docs/compliance/FINAL_COMPLIANCE_REPORT.md` (questions 1-10).
- Technical implementation for the controls above:
  `backend/src/modules/compliance/pure/*`, `backend/migrations/002_compliance.sql`.