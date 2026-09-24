# DRAVIO Acceptable Use Policy

<!-- BEGIN POLICY HEADER -->
- **policy_id:** `aup`
- **name:** Acceptable Use Policy
- **version:** `1.0`
- **effective_at:** `2026-09-01T00:00:00.000Z`
- **required_gates:** `REGISTER`
- **doc_path:** `/docs/policies/acceptable-use-policy.md`
<!-- END POLICY HEADER -->

## 1. What this policy applies to

This Acceptable Use Policy (the "AUP") governs how you may use the DRAVIO marketplace, the relay bandwidth you obtain through it, and the relay bandwidth you offer as a provider ("seller"). It applies to every account, whether you register as a `BUYER`, as a `SELLER`, or both. You accept this policy when you register, and it is a condition of every session routed through the marketplace.

## 2. Acceptable use of marketplace bandwidth

You may use the bandwidth routed through the marketplace for ordinary, lawful internet activity. DRAVIO meters the volume of data transferred for billing purposes and does not inspect, log, or store the content of the traffic routed between buyers and sellers. Because DRAVIO does not review traffic content, compliance with this policy depends on the conduct of each user.

## 3. Prohibited uses

You must not use DRAVIO or any seller's relay connection to:

- Engage in, facilitate, or further any activity that is unlawful under the laws of Kenya or the laws that otherwise apply to the connection you are using, including the distribution of illegal content.
- Store, share, or transmit content that is age-restricted, sexually explicit, or otherwise restricted by law. DRAVIO does not knowingly serve or market its services to children, and age-restricted content is prohibited on the platform.
- Abuse a seller's connection or the seller's underlying internet service. This includes saturating the connection, interfering with the seller's service or equipment, circumventing network limits the seller has set, or using another person's account without authorization.
- Attempt to access, probe, scan, or attack any system, network, or device without authorization (for example, port scanning or intrusion attempts), including the seller's relay or network.
- Send or relay spam, phishing messages, malware, or other malicious payloads.
- Perform credential stuffing or credential brute-forcing, or test stolen credentials against any service.
- Harvest, scrape, collect, or compile personal data or Personally Identifiable Information (PII) of other users or third parties through the marketplace or a seller's connection.
- Interfere with, disrupt, or degrade other buyers' sessions, the seller's service, or the operation of the DRAVIO platform.
- Use the marketplace in any way that would violate the terms of a seller's own internet service provider or the seller's lawful connection rights.

## 4. Children

DRAVIO does not knowingly serve or market the marketplace to children. The platform does not collect date of birth, age, or any age-range data, and there is no mechanism today to distinguish children from adults or to apply age-restricted safelisting. For these reasons, this policy relies on a blanket prohibition: age-restricted content is not permitted on the platform at all, and we do not knowingly collect data from children. We are not able to verify the age of any user; this is a product limitation we disclose rather than an enforcement claim.

## 5. Enforcement is DRAVIO's right, not an obligation

DRAVIO reserves the right, but is under no obligation, to review reports, investigate suspected violations, and take action. Enforcement may include, where the technical mechanism exists:

- Suspending or terminating sessions that are abusive, including terminating a purchased session before it would otherwise end.
- Disabling or limiting the ability to fund a wallet or open new sessions.
- Suspending or terminating the offending account or seller listing.
- Referring conduct to relevant authorities where it appears unlawful.

Enforcement actions are discretionary and may be taken with or without notice. Nothing in this policy obligates DRAVIO to monitor, screen, or moderate traffic, session content, or user communications. DRAVIO does not operate an automated content-scanning or content-moderation system today, and this policy does not claim that one exists.

## 6. Technical enforcement mechanisms that exist today

The following mechanisms genuinely exist in the platform and are the basis for the enforcement this policy describes:

- Session pricing is server-authoritative: a session cannot be opened unless the server can resolve a positive price from the seller's listing, and a minimum wallet balance is required.
- Usage is billed in real time per GB from the buyer's pre-funded wallet using exact cent math; abusive usage depletes the wallet that funds future sessions.
- Sessions can be suspended or terminated on the seller's side and via platform operator controls.
- Seller listings are heartbeat-driven: a listing that stops reporting expires and is no longer offered to buyers.

Where a mechanism named in section 5 does not yet exist in the platform, it is listed as a known gap at the end of this document rather than described as available.

## 7. Reporting

To report an alleged violation, contact abuse@dravio.com. Include as much detail as you can, including session or transaction identifiers if you have them. DRAVIO will review reports on a best-effort basis.

---

## Privacy

<!-- BEGIN POLICY HEADER -->
- **policy_id:** `privacy`
- **name:** Privacy Policy
- **version:** `1.0`
- **effective_at:** `2026-09-01T00:00:00.000Z`
- **required_gates:** `REGISTER`
- **doc_path:** `/docs/policies/acceptable-use-policy.md#privacy`
<!-- END POLICY HEADER -->

This is the DRAVIO Privacy Policy. It is hosted in this file so that the public policy catalog's link for `privacy` resolves; the two documents above describe acceptable use, and this section describes how DRAVIO handles personal data.

### 7.1 Data we collect

- Account data: email address, password hash, optionally phone number, country, and a self-selected role (`BUYER` or `SELLER`).
- Billing data: wallet balance, payment transaction records, ledger entries, and (for sellers) earnings records.
- Session telemetry: bytes transferred, session duration, and routing records used to meter and bill sessions. Traffic content is not collected, logged, or inspected.
- Marketplace seller data: listing price, measured speed and stability, and the relay endpoint and WireGuard public key a seller registers.
- We do not collect age, and we do not collect browsing history, DNS queries, or traffic content.

### 7.2 How we use and share data

Data is used to authenticate you, operate the wallet, meter sessions, settle seller earnings, detect fraud, and discharge audit obligations. We do not sell personal data. Card details used for wallet top-ups are processed by an external payment processor (Stripe hosted checkout) and never reach DRAVIO; M-Pesa transactions are handled through the M-Pesa payment flow.

### 7.3 Retention

Retention durations are configuration, published in the platform's retention registry (see `GET /v1/compliance/retention`). Financial records are retained for accounting and are pseudonymized rather than deleted when you exercise deletion.

### 7.4 Your rights and how to exercise them

You may raise a data-subject rights request in the app or via the API for any of: `ACCESS`, `CORRECTION`, `OBJECTION`, `DELETION`, `PORTABILITY`. Requests are created at `POST /v1/privacy/requests`, are scoped to your own records only, and are fulfilled through a reviewer workflow. Deletion executes the platform's real erasure and pseudonymization plan: identity records (account, providers, refresh tokens, profile, wallet) are erased and financially significant records are retained with personal linkage broken.

### 7.5 Contact

For privacy requests, contact privacy@dravio.app.

---

## Technical implementation notes (internal)

This appendix maps the obligations above to the code and endpoints that implement them. It is internal and not part of the consumer-facing policy text.

| Obligation | Mechanism |
| --- | --- |
| Policy registration and gate wiring | `aup`, `terms`, `privacy` all require the `REGISTER` gate; definitions in `backend/src/modules/compliance/pure/policy-registry.ts` (`POLICY_CATALOG`). Acceptance recorded via `POST /v1/compliance/acceptance` (current-version only; `validateAcceptance` enforces version match and `effectiveAt`). |
| Registration gate | `assertSatisfiesGate('REGISTER', ...)` at `policy-registry.ts:94`; used by acceptance-status reporting. |
| Server-authoritative price + minimum balance | `backend/src/modules/billing/core/session-gate.ts` (`validateSessionStart`: `SELLER_PRICE_UNAVAILABLE`, `INSUFFICIENT_FUNDS`, `MIN_SESSION_BALANCE_USD = 0.5`); price resolved from the seller listing by `marketplace.repository.getTrustedPricePerMb`. |
| Exact per-GB billing | `backend/src/modules/payment/money.ts` (`computeFees`, `settleCentCarry` integer-cent math); consumption processor under `backend/src/modules/billing/services/consumption.processor.ts`. |
| Session suspension/termination | Admin commands `terminate`/`suspend` dispatched to Kafka topic `dm.admin.command` (`backend/src/modules/admin/actions/action-dispatcher.ts`); session termination endpoint in `backend/src/modules/billing/api/routes/session.routes.ts:43`. |
| Listing liveness | Seller heartbeats stored in Redis with a 300-second expiry (`marketplace.repository.updateHeartbeat`); a stopped heartbeat drops the listing from search results. |
| No age data model | `users.profiles` in `master_init.sql` has no age/DOB column; no age gating exists. |
| DSAR API | `POST /v1/privacy/requests`, `GET /v1/privacy/requests`, `GET /v1/privacy/requests/:id`, `POST /v1/privacy/requests/:id/withdraw`, `POST /v1/privacy/requests/:id/review` in `backend/src/modules/privacy/index.ts`; deletion executed by `privacyService.applyDeletion` against the plan in `backend/src/modules/compliance/pure/privacy-rights.ts`. |
| Retention registry | `GET /v1/compliance/retention` from `RETENTION_REGISTRY` in `backend/src/modules/compliance/pure/retention.ts`. |

## Known gaps

- No automated content scanning or moderation system exists. Violations are detected only through reports or manual review; the AUP does not promise otherwise.
- No age verification or age-restricted safelisting is technically possible today: no age data is collected and no dob/age field exists anywhere in the schema.
- The `SELL` gate (provider_terms acceptance) is reported via `GET /v1/compliance/acceptance/status` but is not yet enforced server-side on listing/publishing endpoints.
- Full registration acceptance UI is not implemented in every app yet: `apps/mobile-app/src/screens/Legal.tsx` renders static policy text and does not yet submit acceptance records; `apps/buyer-web` has no policy-acceptance flow. Acceptance records currently come from API calls (`POST /v1/compliance/acceptance`).

---

> This document is DRAVIO's internal policy text. It is not legal advice and does not claim statutory compliance. Applicability of specific laws requires qualified counsel.