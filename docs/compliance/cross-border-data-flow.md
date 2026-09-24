# DRAVIO — Cross-Border Data Flow Assessment

Engineering record of **actual** data flows present in the repository. Statuses:
`PASS` / `PARTIAL` / `FAIL` / `NOT APPLICABLE` / `UNKNOWN` / `LEGAL REVIEW REQUIRED` /
`BLOCKED`. Per-flow transfer-outside-Kenya status is marked `UNKNOWN` /
`NOT CONFIGURED` / `LEGAL REVIEW REQUIRED` wherever the repo cannot prove the geo-location
of a processor. No hosted-region claim is fabricated.

---

## 1. Dataflow diagram

```mermaid
flowchart LR
    subgraph Client
        DEV["Device / mobile app<br/>(expo-secure-store,\n client-generated hardware UUID)"]
        WEB["buyer-web (Next.js)<br/>localStorage device UUID"]
    end

    DEV -->|"HTTPS, TLS, /v1/* REST + Socket.IO"| GW["backend (Fastify)")]
    WEB -->|"HTTPS /v1/*"| GW

    GW --> PG[("PostgreSQL<br/>auth/users/profiles, billing.*,<br/>payments.*, sessions.*,<br/>compliance.*, audit.audit_log")]
    GW --> RD[(Redis<br/>sessions, seller:* hashes,<br/>active_sellers_geo lat/lon)]
    GW --> KF[(Kafka)]]
    KF --> AGG["analytics-aggregator (TS+Py)<br/>writes aggregates → analytics.metrics"]
    KF --> AUDC["audit consumer<br/>writes dm.audit.log → audit.audit_log"]
    KF --> ADM["admin-service<br/>relays dm.vpn.telemetry over Socket.IO to admin-portal"]

    GW -->|"STK push (phone number only; PIN on user's phone)"| MP["M-Pesa Daraja<br/>api.safaricom.co.ke (prod)<br/>sandbox.safaricom.co.ke (default)"]
    MP -->|"callback: CheckoutRequestID, amount, MpesaReceipt"| GW

    WEB -->|"card number/CVV NEVER to DRAVIO"| STRIPE["Stripe hosted checkout<br/>(checkout.dravio.com / Stripe)"]
    STRIPE -->|"payment_intent.succeeded webhook (signed)"| GW

    GW -->|"OTP SMS (phone number)"| TW[("Twilio (if configured)")]

    DEV -->|"OAuth tokens/id_tokens"| OAUTH["Google/Apple/GitHub/<br/>Microsoft/Facebook/X"]
    OAUTH -->|"verification calls"| GW

    GW -->|"avatars (if configured)"| CLOUD[("Cloudinary (env-gated,<br/>NOT configured by default)")]
    GW -->|"identity-token verify (if configured)"| FBA[("Firebase Admin (env-gated,<br/>NOT configured by default)")]
```

---

## 2. Flow inventory and transfer status

### 2.1 Device → backend API

- ENV: `EXPO_PUBLIC_API_URL` (mobile `apps/mobile-app/src/services/api.ts`), buyer-web
  `lib/api.ts`. HTTPS on the public path; dev fallbacks use localhost/LAN IPs (`10.0.2.2`,
  Metro-probed host), never production-safe out of the box.
- Data: JSON API payloads and bearer JWTs; refresh tokens (hashed at rest) round-trip
  once at issue/rotation; access tokens in memory.
- Transfer outside Kenya: **UNKNOWN** — depends on where the deployed backend/API lives.
  Deployment manifests exist (`railway.json`, `render.yaml`, `docker-compose.yml`,
  `koyeb.zip`, `.neon`), but the repo cannot prove the hosting region.
  Status: `UNKNOWN` / `LEGAL REVIEW REQUIRED`.

### 2.2 Stripe — hosted checkout

- `STRIPE_CHECKOUT_BASE_URL` default `https://checkout.dravio.com`; `createPaymentIntent`
  returns `provider_ref` + `client_secret` + `checkoutUrl`
  (`payment/providers/stripe.provider.ts`). The buyer is redirected **out-of-process**;
  card number/CVV never transit or touch DRAVIO servers (see payment-security-scope.md).
- Backend receives only the signed `payment_intent.succeeded` webhook
  (`POST /v1/payments/webhook`, signature-verified via `STRIPE_WEBHOOK_SECRET`).
- Data leaving DRAVIO to Stripe: metadata `{ transaction_id, user_id, session_id, phone_number }` sent **to Stripe** in the PaymentIntent creation call (`payment.service.ts`).
- Transfer outside Kenya: Stripe is a US-headquartered processor; per-event storage
  geography is **UNKNOWN** from the repo. Status: `LEGAL REVIEW REQUIRED`.

### 2.3 M-Pesa via Daraja (Safaricom)

- STK push carries only the user's phone number (normalized to `254…`) and amount; the PIN
  is entered on the user's own phone within the Safaricom/SIM flow — **no PIN ever reaches
  DRAVIO**.
- Callback (`POST /v1/payments/mpesa/callback`) returns `CheckoutRequestID`,
  `MerchantRequestID`, `ResultCode`, amount, `MpesaReceiptNumber`, `PhoneNumber`,
  `TransactionDate`; amount is reconciled against the DB transaction with **5 KES
  tolerance** (`payment.service.ts` — mismatch fails the transaction `AMOUNT_MISMATCH`).
  No cryptographic signature is available for M-Pesa callbacks; integrity depends on the
  secret callback URL, identifier lookup, and amount reconciliation.
- **Production-readiness gap**: `backend/src/modules/payment/providers/mpesa.provider.ts`
  hardcodes `sandbox.safaricom.co.ke` as the fallback (`MPESA_ENV` defaults to `'sandbox'`
  in `config/env.ts`); switching to production requires explicit `MPESA_ENV=production`
  env configuration. Sandbox endpoints survive a misconfiguration.
- Transfer outside Kenya: Safaricom's Daraja API is Kenyan; however DRAVIO cannot prove the
  storage location of all sub-processors, and `MPESA_CALLBACK_URL` must be a reachable
  DRAVIO endpoint (its geo = 2.1). Status: `UNKNOWN` / `LEGAL REVIEW REQUIRED`.

### 2.4 PostgreSQL

- Single `DATABASE_URL`; all schemas live on a local/network-configured Postgres
  (`pg` pool, `backend/src/db/client.ts` family). **No geo-replication is configured in the
  repo.** The `.neon` file suggests a hosted provider may be intended, but region is not
  provable from source. Status: `UNKNOWN` / `LEGAL REVIEW REQUIRED`.

### 2.5 Redis

- `REDIS_URL` default `redis://localhost:6379`. Holds: `session:${sessionToken}` JSON
  (`userId`, `hardwareId`, `pricePerMb`, `sellerId`, `committedBytes`, `pendingCostUsd`),
  seller heartbeat hashes `seller:*`, and the `active_sellers_geo` geospatial set
  (**seller lat/lon** — personal location data). Seller keys TTL 300s; geo-set membership
  persists until removed/replaced.
- Transfer outside Kenya: **UNKNOWN** (`REDIS_URL` geography not provable).
  Status: `UNKNOWN` / `LEGAL REVIEW REQUIRED`.

### 2.6 Kafka events with user identifiers

Topics produced/consumed (per repo):

| Topic | Identifiers in payload | Consumers | Persistence |
|---|---|---|---|
| `dm.audit.log` | `actor_id`, sanitized `metadata` (REDACTED by `audit-events.ts`) | audit consumer (`audit/index.ts`) | → `audit.audit_log` (+ `metadata` JSONB from 002) |
| `dm.payment.completed` | `userId`, `mobile`? no — `mpesaReceipt`, `transactionId`, `amount`, fees, `providerRef` | analytics-aggregator (TS + Python) | only aggregate `analytics.metrics` counters (`total_revenue`) |
| `dm.session.kill` | `sessionToken`, `hardwareId`, `userId`, `reason` | relay consumers | not persisted (kill switch broadcast) |
| `dm.session.completed` | (subscribed by aggregator) | analytics-aggregator | `total_sessions` counter only |
| `dm.vpn.telemetry` | session/network telemetry | admin-service relay | re-broadcast over Socket.IO; **not persisted** (`analytics.session_telemetry` table declared but has no writer in repo) |

- The **event payloads on the wire carry personal identifiers** even though the consumers
  reduce them to non-personal aggregates. The Kafka broker (`KAFKA_URL`) location and
  topic retention are **UNKNOWN** from the repo. Status: `UNKNOWN` / `LEGAL REVIEW REQUIRED`.

### 2.7 OAuth identity providers

- `POST /v1/auth/oauth` verifies against Google/Apple/GitHub/Microsoft/Facebook/X via
  `ProviderVerifier` (id_token / access_token), then stores
  `auth.providers.(provider_name, provider_id, provider_email)`.
- These are US-headquartered identity providers; token/account data round-trips to them.
  Status: `LEGAL REVIEW REQUIRED` (provider storage geography outside DRAVIO control).

### 2.8 Twilio (phone OTP) — if configured

- `apps`-side and `otp.service.ts`: sends SMS verification via Twilio Verify
  (`TWILIO_ACCOUNT_SID` etc.). Phone number leaves DRAVIO to Twilio (US) when configured.
  Without env, OTP login returns `OTP_UNAVAILABLE` (503). Status:
  `NOT CONFIGURED` (default) / `LEGAL REVIEW REQUIRED` (if enabled).

### 2.9 Cloudinary — if configured

- `users/utils/cloudinary.ts` initializes eagerly and throws `FATAL` when the three
  `CLOUDINARY_*` vars are absent — but `config/env.ts` declares them **optional**, so the
  service is intended for avatar upload only when explicitly configured. Status:
  `NOT CONFIGURED` (default) / `LEGAL REVIEW REQUIRED` (if enabled; image uploads of faces
  would be personal data).

### 2.10 Firebase Admin — env-gated

- `auth/utils/firebase-admin.ts` initializes only if
  `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` are set; used for
  OAuth (Google/Apple) verification. Status: `NOT CONFIGURED` (default) /
  `LEGAL REVIEW REQUIRED` (if enabled).

---

## 3. Cross-border transfer controls (Kenya DPA 2019 lens)

Status per control:

| Control | Status | Basis |
|---|---|---|
| Cross-border transfer inventory | `UNKNOWN` | Flows above are inventoried; processor geographies are not provable from the repo |
| Adequacy / safeguards for transfers (SCCs, adequacy, consent) | `LEGAL REVIEW REQUIRED` | No DPA/transfer documents exist in the repo |
| Processor agreements (Stripe, Safaricom, Twilio, OAuth providers, Cloudinary, Firebase) | `LEGAL REVIEW REQUIRED` | Not present in the repository |
| Enforceability of transfers upon DELETION | `UNKNOWN` | Pseudonymization plan does not reach provider-held copies of metadata (e.g. Stripe metadata containing `user_id`) |

Note: Stripe PaymentIntent metadata (which carries `user_id`, `session_id`, `phone_number`)
is provided **to Stripe** at intent creation and is subject to Stripe's retention — DRAVIO
cannot erase provider-held copies via `applyDeletion`. Whether this needs contractual
remediation is **LEGAL REVIEW REQUIRED**.