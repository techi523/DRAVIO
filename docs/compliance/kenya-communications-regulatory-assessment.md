# DRAVIO — Kenya Communications Regulatory Assessment (preliminary)

**Status of this document: a preliminary *technical interpretation*, not a legal
conclusion.** Every classification below uses the four-way bucket and, per bucket,
explicitly requires confirmation by the Communications Authority of Kenya (CA) and/or
qualified counsel before acting. **Nothing in this document asserts "no license is
required" as fact.**

Buckets used: `LIKELY REQUIRED` / `POSSIBLY REQUIRED` / `NOT IDENTIFIED` /
`REQUIRES LEGAL/CA CONFIRMATION`.

Source statutes are referenced only to frame the *open questions* (Kenya
**Information and Communications Act, 1998 (Cap 411A)** and related CA licensing/consumer
regimes). No statutory answer is asserted as fact.

---

## 1. What DRAVIO actually does (technical facts from the repo)

- Operates a **marketplace**: buyers pre-fund wallets (`billing.wallets`), buy data
  packages, and are routed to connectivity shared by sellers; sellers publish
  availability via `POST /v1/marketplace/heartbeat` (lat/lon, price per GB/MB) stored in
  Redis; sessions are routed through seller relayed WireGuard-style tunnels
  (`relay_endpoint`/`relay_public_key` in marketplace listing).
- Platform fee 20% default (`PLATFORM_FEE_PCT`, clamped 0–50%): buyer pays package price,
  fee deducted from seller's net (computed in integer cents in `payment/money.ts`).
- Payments: Stripe hosted checkout + M-Pesa STK push (see payment-security-scope.md).
  **Payouts are BLOCKED** — withdrawal only writes a `payments.payouts` row with status
  `PENDING`; no disbursement mechanism exists (`POST /v1/billing/withdraw`).
- Provider onboarding admits `INDIVIDUAL`, `BUSINESS`, `ISP`, `HOTSPOT_OPERATOR`,
  `NETWORK_OPERATOR`, `OTHER_AUTHORIZED_PROVIDER` (config-driven, `provider-intake.ts`);
  statuses SUBMITTED/APPROVED/REJECTED/WITHDRAWN.

**Key honesty caveat**: DRAVIO does not itself provision, transmit, or interconnect with
licensed network operators in the code served in this repo. Sellers supply connectivity.
Whether the marketplace operator nonetheless holds a CA category is an open question.

---

## 2. Activity-by-activity classification

### 2.1 Hotspot re-selling / sharing an existing internet connection for compensation

- What the code does: sellers list a connection (lat/lon, pricing) and buyers pay to use it.
- Classification: **LIKELY REQUIRED** (as a question, not an assertion). Reselling
  Internet access to the public is an activity commonly subject to CA licensing /
  operator-terms scrutiny in Kenya; whether DRAVIO-as-marketplace and/or each seller needs
  authorization is unconfirmed.
- `REQUIRES LEGAL/CA CONFIRMATION`: which entity is the "operator" (the seller reselling
  their own line, or the platform enabling it), and which CA service category (if any)
  applies.

### 2.2 DRAVIO being an "ISP" / applying for a service license

- What the code does: none — no network, no spectrum, no interconnection with licensed
  operators; DRAVIO is an application/marketplace layer.
- Classification: **POSSIBLY REQUIRED**. The question is whether DRAVIO's aggregation and
  monetization of third-party connectivity places it within a CA service-provider
  category. Not asserted either way.
- `REQUIRES LEGAL/CA CONFIRMATION`: precise license category and whether the marketplace
  model is distinguishable from a resale/APP operation.

### 2.3 Providing public WLAN / hotspot coverage to third parties

- What the code does: sellers publish public access points; buyers locate them by
  geo-search (`GET /v1/marketplace/search`).
- Classification: **POSSIBLY REQUIRED** (operator/Hotspot category question).
- `REQUIRES LEGAL/CA CONFIRMATION`: whether a seller offering public WLAN for payment must
  hold CA authorization or merely operate under a licensed operator's agreement.

### 2.4 Interconnect obligations with licensed network operators

- What the code does: none — there is no SS7/peering/interconnection, no carrier-grade
  interconnect, no numbering/channeling.
- Classification: **NOT IDENTIFIED** in the codebase for a pure application-layer
  marketplace; however, if H2.2/H2.3 resolve such that DRAVIO or its sellers are treated
  as network/service providers, interconnect obligations could follow.
- `REQUIRES LEGAL/CA CONFIRMATION` before reliance on the "none" interpretation.

### 2.5 Consumer protection: price transparency, tariffs, billing disclosure

- What the code does: backend fee-disclosure endpoint exists
  (`GET /v1/compliance/fee-disclosure`, `fee-disclosure.ts`, integer-cent exact math);
  **no app UI displays the breakdown before purchase** (verified — that is a known gap).
  Withdrawal messaging asserts "Funds arrive within 1-3 business days" with no
  disbursement capability (misleading if relied upon).
- Classification: **POSSIBLY REQUIRED** — fair-trading / consumer-protection obligations
  (including transparent tariff display to buyers and truthful payout promises) are a
  question for CA/consumer regulators.
- `REQUIRES LEGAL/CA CONFIRMATION`: whether the `PASS`-grade backend fee math satisfies
  disclosure/consumer rules despite the missing UI, and whether the payout wording must be
  corrected.

### 2.6 Fair competition and anti-exclusive-marketplace practices

- What the code does: open heartbeats from any SELLER; no exclusivity, no price fixing, no
  geo-exclusivity logic found.
- Classification: **NOT IDENTIFIED** (as a code matter). Competition compliance depends on
  conduct in operation rather than code.
- `REQUIRES LEGAL/CA CONFIRMATION`: market-share, parity, and conduct questions are
  outside this repo.

### 2.7 Data resale of metered packages / broadband "data arbitrage"

- What the code does: buyers purchase GB/MB allowances and sessions are metered
  (`billing.sessions`, `usage_records`, `seller_earnings`).
- Classification: **POSSIBLY REQUIRED** — the resale of data to the public may engage
  operator fair-use terms and CA resale licencing categories.
- `REQUIRES LEGAL/CA CONFIRMATION`: whether per-package resale is a licensable service.

---

## 3. Obligation map (summary grid)

| Activity | Bucket | Confirmation needed |
|---|---|---|
| Hotspot/internet re-selling for compensation | `LIKELY REQUIRED` | Who is the operator, and under which CA category |
| DRAVIO as "ISP"/service-license applicant | `POSSIBLY REQUIRED` | Marketplace-vs-resale classification; correct category |
| Public WLAN provision by sellers | `POSSIBLY REQUIRED` | Seller authorization path |
| Interconnect obligations | `NOT IDENTIFIED` (current code); `REQUIRES LEGAL/CA CONFIRMATION` if classified as network/service provider | Re-classification gate |
| Consumer protection / tariff transparency | `POSSIBLY REQUIRED` | Whether backend-only fee disclosure suffices; payout wording correctness |
| Fair competition | `NOT IDENTIFIED` (code); operations-dependent | Operational review |
| Data resale licence question | `POSSIBLY REQUIRED` | Resale category existence under CA |

---

## 4. Explicit positions

- All four buckets above are **preliminary technical interpretations**. None is a legal
  or regulatory conclusion.
- **The CA must confirm** any category mapping before DRAVIO or its sellers act in
  reliance on it.
- **No assertion is made that DRAVIO needs no license**, and none is made that one is
  definitely required; the classification is deliberately provisional.
- Payouts being non-functional (see §1) means any revenue-share model tied to
  seller earnings currently has **no live money movement** — regulatory exposure on the
  payout leg is `BLOCKED`/`PROVIDER CAPABILITY REQUIRED` rather than analyzed.