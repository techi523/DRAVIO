# DRAVIO — Policy / Terms / Privacy Statement Integrity Audit (point 36, partial 44)

Every claims text in `docs/policies/*` and the privacy/terms screens shipped in the apps
is compared against actual system behavior, cross-checked against
`backend/src/modules/compliance/pure/policy-registry.ts`,
`fee-disclosure.ts`, `payment/money.ts`, `payment/core/transaction-machine.ts`,
`privacy-rights.ts`, `retention.ts`, `wallet.routes.ts`, and `session-gate.ts`.

Verdicts: `MATCH` (behavior provable in code), `MISMATCH` (statement not supported by
code), `PARTIAL` (true in part / no longer fully true / satisfying a weaker reading only),
`UNVERIFIABLE` (no in-repo evidence), `STALE-DOC` (doc contradicts itself or current code).

---

## 1. Policy-notice-to-behavior matrix

| # | Claim (verbatim, source) | Behavior (evidence) | Verdict |
|---|---|---|---|
| P-01 | AUP: "…it is a condition of every session routed through the marketplace" (acceptable-use-policy.md:14) | Sessions require auth + server-authoritative price + balance (`session-gate.ts:26-34`); no AUP re-check per session | PARTIAL (no per-session AUP gate wired) |
| P-02 | AUP: "DRAVIO … does not inspect, log, or store the content of the traffic" (acceptable-use-policy.md:18) | No content/PAN/DNS capture anywhere; only byte counts metered (`billing`/`analytics` tables, `master_init.sql:112-122,184-191`) | MATCH |
| P-03 | AUP §7.1: collects "Account data: email address, password hash, optionally phone number, country, role" | `auth.users` email+password_hash (`master_init.sql:16-23`); `users.profiles` email/phone/country (`:51-62`) | MATCH |
| P-04 | AUP §7.3: "Financial records … are pseudonymized rather than deleted when you exercise deletion" | No retained column is rewritten; raw UUIDs kept (see lifecycle audit D-06/D-13; `privacy.service.ts:117-120` touches only `billing.sessions`); DSAR tables keep PII copies (D-09) | MISMATCH (overstated: "pseudonymized") |
| P-05 | AUP §7.4: "identity records (account, providers, refresh tokens, profile, wallet) are erased" | Deletes execute exactly those 5 stores (`privacy.service.ts:91-112`) | MATCH |
| P-06 | AUP §7.4: "financially significant records are retained with personal linkage broken" | Identity join row removed, but retained stores keep raw UUIDs / DSAR-table PII; linkage not cryptographically broken | PARTIAL |
| P-07 | AUP app. "known gaps": "The `SELL` gate … not yet enforced server-side on listing/publishing endpoints" | Heartbeat gates only on role `['SELLER']`, not acceptance (`marketplace/index.ts:8`; `policy-registry.ts:49-55`) | MATCH (internal gap statement accurate) |
| P-08 | buyer-terms B.2: "The default platform fee is 20 percent … borne by the seller, so it never increases the price you pay" | `money.ts:5` DEFAULT 0.20; `fee-disclosure.ts:13,27-29` feeBearer SELLER, buyer = package price | MATCH |
| P-09 | buyer-terms B.2: "Fees … exact integer-cent arithmetic; no hidden or fabricated fractions" | `money.ts:30-40`, `settleCentCarry` carry-over math (`money.ts:55-60`) | MATCH |
| P-10 | buyer-terms B.3: "Card top-ups use an external hosted checkout operated by Stripe; card details never reach DRAVIO" | Stripe PaymentIntent + webhook; no PAN fields (`payment/index.ts:29-62`; P-01 compliance matrix) | MATCH |
| P-11 | buyer-terms B.3: "M-Pesa STK push is also supported" | M-Pesa STK + callback reconciliation (`payment.service.ts:100-139`) | MATCH |
| P-12 | buyer-terms B.3: "a minimum balance is required" | `MIN_SESSION_BALANCE_USD = 0.5` (`session-gate.ts:4,32`) | MATCH |
| P-13 | buyer-terms B.5: "You may open a dispute … reason required … moves the transaction into a disputed state" | BUYER+owner to DISPUTED, reasonRequired (`transaction-machine.ts:63,70,74,84`; `payment/index.ts:148-167`) | MATCH |
| P-14 | buyer-terms B.5/B.6: "Moving money … only by a billing administrator … audited"; "Refund timelines are not set" | REFUND/PARTIAL_REFUND/REVERSE/CANCEL gated to BILLING_ADMIN/ADMIN with reason, CAS + `transaction_events` (`payment/index.ts:169-200`; `transaction-machine.ts:71-83`; `002_compliance.sql:16-26`); no SLA in code | MATCH |
| P-15 | buyer-terms A.1: "By creating a DRAVIO account you agree to these Terms, AUP, Privacy" | No consent capture at registration: `POST /v1/compliance/acceptance` requires an authenticated session (`compliance/index.ts:32`); `REGISTER` gate defined but never enforced (`policy-registry.ts:21-38,94-112`); register route has no gate check (`auth/index.ts:32-67`) | MISMATCH (registration-time acceptance claimed, no mechanism) |
| P-16 | buyer-terms A.6: "You may delete your account at any time." | Deleting requires a registered DELETION request fulfilled by an ADMIN/BILLING_ADMIN reviewer (`privacy/index.ts:112-149`); no self-service path; erasure incomplete per lifecycle audit D-06…D-10 | PARTIAL |
| P-17 | provider-terms §4: "The default platform fee is 20 percent" + exactness | `money.ts:5`, `fee-disclosure.ts:34-42` | MATCH |
| P-18 | provider-terms §5: "Payouts are not yet functional … writes `PENDING` … no money movement … does not promise any payout timeline"; "a withdrawal … debits the ledger balance … even though the outbound transfer is not performed" | `wallet.routes.ts:61-75` deducts balance and inserts `payments.payouts` PENDING; response message: "Payout processing is not yet available — no funds have been transferred. Your wallet balance already reflects the deduction." (`wallet.routes.ts:94`) | MATCH (payout disclosure is honest) |
| P-19 | provider-terms §8: the "`SELL` gate … is still being wired end to end" + internal gap "a `SELLER`-role account can currently publish a heartbeat even without an accepted current `provider_terms` version"; intake approval not a prerequisite | Heartbeat role-gate only (`marketplace/index.ts:8`; `provider/index.ts:11`); no acceptance/approval check on publish | MATCH |
| P-20 | provider-terms Known gaps: "`POST /v1/billing/withdraw` … returns a canned delivery-time message ('funds arrive within 1-3 business days')" | Current code returns the honest no-rail disclosure (`wallet.routes.ts:94`). The gap note preserves the pre-fix text and contradicts §5 + FINAL report "fixed" (FINAL_COMPLIANCE_REPORT.md:155-156) | STALE-DOC (internal self-contradiction) |
| P-21 | provider-terms §7: "financial records … pseudonymized, not destroyed … broken personal linkage" | Retained stores keep raw UUIDs; no rewrite; DSAR-table PII copies persist (lifecycle D-06/D-09/D-13) | PARTIAL |
| P-22 | buyer-web Privacy §1: "Marketplace seller data … derived from **anonymised** seller heartbeats" | Heartbeats stored keyed by seller_id with relay_endpoint, relay_public_key, geo, price — not anonymized (`marketplace.repository.ts:58-97`) | MISMATCH ("anonymised" is false) |
| P-23 | buyer-web Privacy §4: "Session telemetry is retained as long as your account exists." | `analytics.session_telemetry` 730 d and `billing.sessions` 3650 d, both legally retained (`retention.ts:99-115,126-133`); not "as long as account exists" | MISMATCH (duration claimed ≠ registry) |
| P-24 | buyer-web Privacy §4: "You may request deletion of your account and associated data at any time." | Request creation is possible, but fulfillment is reviewer-gated and erasure is incomplete (lifecycle D-07…D-13) | PARTIAL |
| P-25 | mobile Privacy §6: "Session records are retained for 12 months for billing disputes." | `billing.sessions` 3650 d, `sessions.routing` 3650 d, `analytics.session_telemetry` 730 d (`retention.ts:99-115,126-133`) | MISMATCH (12 months ≠ 3650 d registry) |
| P-26 | mobile Privacy §7: "Right to … Delete your account and data / Export your data" | No delete or export flow exists in the app (grep of `apps` for `privacy/requests`/delete controls returns nothing; `Profile.tsx` has no delete entry, rows 151-159) | MISMATCH / BLOCKED (rights listed, not exercisable in-app) |
| P-27 | mobile Terms §6: "Earnings are paid out **weekly** to verified accounts." | Payouts non-functional; no pipeline, no schedule (`wallet.routes.ts:87`, `:94`; provider-terms §5) | MISMATCH (fabricated timeline) |
| P-28 | mobile Terms §6: "DRAVIO takes a platform fee per session (**displayed at time of transaction**)." | Fee exists (20% seller-borne, `money.ts:5`) but is only exposed via `GET /v1/compliance/fee-disclosure` API (`compliance/index.ts:97-109`); no transaction-time display in any app | MISMATCH ("displayed at time of transaction" false) |
| P-29 | mobile Terms §7: "You may delete your account at any time **from the Profile screen**." | `Profile.tsx` exposes Edit Profile / Payout / Security / Alerts / Optimizer rows; no delete control; no DSAR call | MISMATCH (feature does not exist) |
| P-30 | mobile Terms §2 / Privacy §9: "at least 16 years old" / "not for users under 16" | No age collection/gate exists (no DOB field; `users.profiles` has none, `master_init.sql:51-62`); AUP §4 concedes "no mechanism … to distinguish children" | PARTIAL (honest limitation in AUP; app screens state a policy without mechanism) |
| P-31 | mobile Privacy §2: "encrypted password hash"; AUP §7.1 "password hash" | `auth.users.password_hash` bcrypt (compliance matrix I-03) | MATCH |
| P-32 | mobile Privacy §5: "We may share data with … Infrastructure providers (encrypted, under strict agreements)" | No processor list / agreements in repo | UNVERIFIABLE |
| P-33 | mobile Privacy §8: "All data encrypted in transit (TLS 1.3) and at rest (AES-256)" | No TLS or at-rest encryption configuration in repo (matrix D-13 "assumed", PARTIAL) | UNVERIFIABLE |
| P-34 | Accept/consent at registration (all docs, e.g. AUP:14 "You accept this policy when you register") | See P-15 | MISMATCH |
| P-35 | Registry/doc integrity: 5 catalog entries v1.0 effective 2026-09-01; doc headers match ids/versions | `policy-registry.ts:15-56`; headers in all three policy files | MATCH |

---

## 2. App-store / platform requirements (partial — point 44)

| Requirement | DRAVIO status | Verdict |
|---|---|---|
| Google Play Data Safety: declare collected data + "data deletion" capability for accounts | Backend DSAR API exists but no app flow; deletion incomplete (see P-26/D-09) | PARTIAL / BLOCKED — no in-app deletion/export |
| Apple App Store Review Guideline 5.1.1(v): "apps that support account creation must also allow users to initiate deletion of their account within the app" | No deletion control in `Profile.tsx` or any app screen; deletion requires an operator ADMIN role (`privacy/index.ts:112`) | BLOCKED |
| Disclosure of data categories (personal data, contact info, financial info, identifier) in store listings | Some disclosures in app privacy screens (identity, device OS/app version) exist but are partial and partly unverifiable (P-22, P-32, P-33) | PARTIAL |
| Privacy policy URL in store listing | Privacy text exists in-app and in `docs/policies/acceptable-use-policy.md#privacy`; no external hosted URL in repo | PARTIAL |

---

## 3. Findings summary (IDs P-01…P-35; store flags S-01…S-04)

- `MATCH`: P-02, P-03, P-05, P-07, P-08, P-09, P-10, P-11, P-12, P-13, P-14, P-17, P-18, P-19, P-31, P-35
- `MISMATCH`: P-04, P-15, P-22, P-23, P-25, P-26, P-27, P-28, P-29, P-34
- `PARTIAL`: P-01, P-06, P-16, P-21, P-24, P-30
- `UNVERIFIABLE`: P-32, P-33
- `STALE-DOC`: P-20
- App-store: `BLOCKED` ×2 (account deletion), `PARTIAL` ×2

Most consequential statement-vs-code divergences:
1. P-27 — mobile Terms promise "paid out weekly" where payouts are non-functional (the one fabricated timeline the 2026 fix explicitly removed at the API layer, `wallet.routes.ts:94`, but the app Terms still assert it).
2. P-29 / P-26 — "delete your account from the Profile screen" and in-app account deletion/export: no such control or flow exists in any app.
3. P-28 — "fee displayed at time of transaction": fee disclosure is API-only.
4. P-25 / P-23 — retention durations claimed in-app (12 months; "as long as your account exists") contradict the retention registry (3650/730 days).
5. P-04 — "records pseudonymized … rather than deleted" overstates deletion; retained stores keep raw UUIDs and DSAR tables retain PII copies (lifecycle D-09).

Honest claims that should be preserved: payout unavailability (P-18), refund/refund-timeline honesty (P-14), 20% seller-borne fee exactness (P-08/P-09/P-17), and the in-document known-gap disclosures (P-07, P-19).

---

*Technical audit; not legal advice. See FINAL_COMPLIANCE_REPORT.md for the legal-review queue.*