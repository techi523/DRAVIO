# DRAVIO — Data Lineage Map

Where personal, financial, telemetry, location, and security-log data enters, flows, is stored, is transformed, and is erased across the DRAVIO platform. Research-only; each hop cites a verified path. Statuses: `VERIFIED` / `PARTIAL` / `FAILED` / `BLOCKED` / `NOT VERIFIED` / `NOT APPLICABLE` / `LEGAL REVIEW REQUIRED` / `UNCONFIRMED`.

Companion to `docs/compliance/cross-border-data-flow.md` (Kenya DPA 2019/cross-border analysis).

---

## 1. Systems of record

| Store | Contents | Keys / schema | Evidence | Status |
|---|---|---|---|---|
| PostgreSQL (single `DATABASE_URL`) | auth, users, payments, billing, sessions, analytics, audit, compliance schemas | `master_init.sql:3-9` | `backend/src/db/client.ts:9-23` | VERIFIED |
| Redis | `session:<id>` JSON, `seller:*` heartbeat hashes, `active_sellers_geo` (lat/lon), usage counters | TTL 300s sellers — `marketplace.repository.ts:96`; 24h sessions | `marketplace.repository.ts:94-96`; `session/index.ts:72`; `metering/index.ts:29` | VERIFIED |
| Kafka `dm.*` topics | event bus; identifiers on the wire; consumers aggregate | topics: `docker-compose.yml:295-299`, `audit/producer.ts:9` | `docker-compose.yml:287-300` | VERIFIED |
| MongoDB | container only — **no application consumer in repo** | `mongo:6.0` | `docker-compose.yml:302-312`; grep `mongodb|mongoose` in `backend/src`,`apps` → zero | NOT APPLICABLE (defined, unused) |
| WireGuard container | runtime tunnel peers; **no peer-provisioning code in repo** | `51820/udp`, `ALLOWEDIPS 0.0.0.0/0` | `docker-compose.yml:314-336` | VERIFIED container; NOT VERIFIED runtime |
| Client storage | access token / profile / hardware UUID | SecureStore (mobile `expo-secure-store`), localStorage (web) | `apps/mobile-app/package.json:31`; browser storage keys in app source | VERIFIED |
| Provider-side copies | Stripe metadata (incl. `phone_number`), M-Pesa, Twilio, OAuth providers, Cloudinary-if-enabled | — | `payment.service.ts:49-59`; `cross-border-data-flow.md:126-138,165-170` | LEGAL REVIEW REQUIRED |

---

## 2. PostgreSQL schema → tables

| Schema | Tables | Evidence |
|---|---|---|
| `auth` | `users`, `providers`, `refresh_tokens` | `master_init.sql:16-44` |
| `users` | `profiles` | `master_init.sql:51-62` |
| `payments` | `transactions`, `payouts` | `master_init.sql:69-95` |
| `billing` | `wallets`, `sessions`, `invoices`, `usage_records`, `seller_earnings`, `ledger_entries` (hardening) | `master_init.sql:102-253`; `backend/migrations/001_hardening.sql` |
| `sessions` | `sessions`, `handoffs` | `master_init.sql:150-170` |
| `analytics` | `metrics`, `session_telemetry` (declared; **no writer**) | `master_init.sql:177-191`; `analytics/index.ts:19-31` (writes only `metrics`) |
| `audit` | `audit_log` (+ `metadata` JSONB) | `master_init.sql:198-207`; `backend/migrations/002_compliance.sql:8-9` |
| `compliance` | `transaction_events`, `privacy_requests`, `provider_intake`, `policy_acceptances`, `retention_rules`, `sanctions_config` | `backend/migrations/002_compliance.sql:13-123` |
| `isp` | adapter-only (no tables in repo) | VERIFIED absence |

---

## 3. Lineage hops by category

### 3.1 Identity
- **Collection:** register/login form → `POST /v1/auth/register` (`auth/index.ts`); OAuth via `ProviderVerifier` (Google/Apple/Firebase, GitHub/Microsoft/Facebook/X REST) → `auth.providers(provider_name, provider_email)` (`provider-verifier.ts` per `cross-border-data-flow.md:126-131`); OTP phone → Twilio when configured else `OTP_UNAVAILABLE` (`env.ts:40-42`).
- **Processing:** `auth.service.ts` — bcrypt hash (cost 10) — `auth/service/auth.service.ts:14`; profile created + rollback on failure — `:24-37`.
- **Storage:** `auth.users` (password_hash), `auth.refresh_tokens` (`token_hash`, 30d) — `master_init.sql:16-44`, `env.ts:53-54`; `users.profiles` (email/full_name/kyc_level/country_code/phone_number/is_seller) — `privacy.service.ts:20-24`.
- **Transfer:** JWTs signed `JWT_SECRET` (HS256) — `index.ts:81-83`; cookies from Neon auth middleware; caller-controlled OAuth tokens round-trip to providers.
- **Use:** `autorize/authenticate` decorators gate routes — `auth/middleware.ts:5-27`; buyer/seller roles in token `sub`/`roles`.
- **Retention:** `auth.credentials` 36500d, erase on deletion — `compliance/pure/retention.ts:16-43`.
- **Deletion:** `privacy.service.ts:84-130` deletes `auth.users/providers/refresh_tokens` + `users.profiles` + `billing.wallets`, pseudonymizes `billing.sessions.customer_id` → `'deleted:'||id` (`:117-120`). Plan source: `compliance/pure/privacy-rights.ts:102-132`.

### 3.2 Payments
- **Collection:** `POST /v1/payments/initiate` (auth) → schema-validated — `payment/index.ts:9-27`; policy gate `PURCHASE` acceptance enforced — `payment.service.ts:10-21`; idempotency key → `ON CONFLICT DO NOTHING` — `:23-47`.
- **Processing (money):** integer math `money.ts` (`computeFees`, fee bounds 0..0.5 — `env.ts:50`); provider card data never transits DRAVIO (Stripe hosted), metadata `{transaction_id, user_id, session_id, phone_number}` sent to Stripe — `payment.service.ts:49-59`; M-Pesa normalized phone + amount, PIN on device.
- **Completion (two write paths):**
  1. Stripe webhook `payment_intent.succeeded`, signature-verified, Ticket-only-PENDING replay-safe → `completeAndCredit` — `payment/index.ts:36-61`, `payment.service.ts:77-98`.
  2. **M-Pesa callback unauthenticated**, amount-reconciled ±5 KES, PENDING-gate replay-safe → `completeAndCredit` — `payment/index.ts:64-80`, `payment.service.ts:100-139`.
- **Storage:** `payments.transactions` (+`provider_ref`, fee columns), `billing.wallets` credit + `billing.ledger_entries` append-only in one transaction — `commit` path per `migrations/001_hardening.sql`; payouts PENDING-only (no disbursement).
- **Transfer:** `dm.payment.completed` carries `{transactionId, userId, amount, platformFeeUsd, sellerNetUsd, providerRef, mpesaReceipt}` — `payment.service.ts:141-162` → analytics reduces to `total_revenue` counter — `analytics/index.ts:27-31`.
- **Retention:** `payments.transactions`/`payouts` 7300d legally retained; `ledger_entries` append-only indefinite — `retention.ts:45-88`.
- **Deletion:** financial rows retained, personal linkage broken (identity rows removed, UUID kept) — `privacy-rights.ts:119-130`.

### 3.3 Network / relay / WireGuard
- **Collection:** `POST /v1/sessions` (auth) — buyer_id from token only — `session/index.ts:41-44`; seller relay resolved from Redis (real endpoint + pubkey; placeholder values rejected) — `session/index.ts:29-38`, `marketplace.repository.ts:85-92,45-49`.
- **Config:** WireGuard config synthetized from seller's relay (client PrivateKey is a device-side sentinel; Peer = seller public key/endpoint, AllowedIPs 0.0.0.0/0) — `session/access.ts:28-41`. Fails closed if no live relay — `:32-36`.
- **Handoff:** requires new seller to have registered relay — `session/index.ts:122-124`; ownership/admin gated — `:108-111`.
- **Storage:** `session:<id>` in Redis (buyer/seller/relay) TTL 24h — `session/index.ts:18,70-73`; legacy `sessions.sessions`/`handoffs` tables — `master_init.sql:150-170`.
- **Transfer:** `dm.session.started` (`session/index.ts:75-81`); admin `dm.vpn.telemetry` relay over Socket.IO (consumers only — `admin/index.ts:144-165`); kill-switch broadcast `session-manager.ts:75-82`.
- **Deletion:** record pseudonymized on account deletion (`billing.sessions`); sessions.routing retained — `privacy-rights.ts:116-126`.

### 3.4 Usage / metering
- **Collection:** `POST /v1/billing/sessions/start` (auth) resolves server-authoritative price — `billing/core/session-manager.ts:20-63`; `sessionRepository.createSession` → `billing.sessions` — `:50`.
- **Metering:** `dm.usage.ticks` → Redis `incrby session:<id>:usage` — `metering/index.ts:18-29`; `getUsage` — `:39-42`.
- **Billing:** per-session data recorded; usage_records retention 730d — `retention.ts:108-115`.
- **Analytics:** `dm.session.completed` → `total_sessions` counter only — `analytics/index.ts:19-26` (no identifiers persisted).

### 3.5 Location
- **Collection:** seller heartbeat `lat`/`lon` → `GEOADD active_sellers_geo` + `seller:<id>` hash — `marketplace.repository.ts:94-96`; last_seen TTL 300s — `:96`.
- **Use:** geo search over `active_sellers_geo` — `:149-154`; buyer location not stored server-side (query-time only).
- **Flags:** seller lat/lon is personal location data; Redis TTL is the only lifecycle. Retention registry has no dedicated location row (`retention.ts` — no category) — `LEGAL REVIEW REQUIRED`.

### 3.6 Security & audit logs
- **Collection:** audited actions emit `dm.audit.log` — `audit/producer.ts:9,21-35`; sanitized event builder `compliance/pure/audit-events.ts` (redaction) — referenced `producer.ts:7,23-30`.
- **Storage:** audit consumer persists to `audit.audit_log` + metadata JSONB — `audit/index.ts`, `migrations/002_compliance.sql:8-9`.
- **Consumers:** admin incidents (`admin/index.ts:72-88`), instrumented by `compliance.transaction_events` for payment transitions (`002_compliance.sql`).
- **Retention:** audit_log 36500d append-only — `retention.ts:144-151`.
- **Deletion:** audit rows kept with actor marker on deletions — `privacy-rights.ts:129`.

---

## 4. Kafka topics (producers/consumers)

| Topic | Producer | Payload identifiers | Consumer | Persistence | Evidence |
|---|---|---|---|---|---|
| `dm.auth.user_registered` | auth flow (declared) | email/UUID | — | — | `docker-compose.yml:295` |
| `dm.session.started` | session flow | session_id, buyer_id, seller_id, relay_id | — | Redis copy | `session/index.ts:75-81`, `docker-compose.yml:296` |
| `dm.session.completed` | session flow (declared) | session token/user id/bytes | analytics | `total_sessions` only | `analytics/index.ts:19-26`, `docker-compose.yml:297` |
| `dm.payment.completed` | `payment.service.ts:141-162` | transactionId, userId, amount, fees, providerRef, mpesaReceipt | analytics | `total_revenue` only | `analytics/index.ts:27-31`, `docker-compose.yml:298` |
| `dm.usage.ticks` | metering | session/bytes | metering module | Redis counters | `metering/index.ts:18-29` |
| `dm.audit.log` | `producer.ts:21-35` | actor_id + REDACTED metadata | audit module | `audit.audit_log` | `audit/index.ts` |
| `dm.security.alert`, `dm.billing.transaction`, `dm.vpn.telemetry`, `dm.admin.lockdown` | event source (legacy/relay) | varies | admin module (Socket.IO relay) | not persisted | `admin/index.ts:102-106,144-165` |
| `dm.metering.update` | metering (Go) | bytes/session | (declared) | — | `docker-compose.yml:299` |

Broker location/retention not configurable from repo — `UNKNOWN / LEGAL REVIEW REQUIRED` (see `cross-border-data-flow.md:109-123`).

---

## 5. Retention & deletion policy registry (pure module)

Registry of record: `compliance/pure/retention.ts:16-152` (mirrors seeded `compliance.retention_rules`). Highlights:

| Category | Duration | Legally retained | Auto-deletable |
|---|---|---|---|
| auth.credentials / social_providers | 36500d | no | yes |
| auth.refresh_tokens | 30d | no | yes (revoked on logout) |
| payments.transactions / seller_earnings / payouts | 7300d | yes | no (anonymized) |
| billing.ledger_entries | null (append-only) | yes | no |
| billing.sessions / sessions.routing | 3650d | yes | no |
| billing.usage_records / analytics.session_telemetry | 730d | yes | no |
| device.identifier | 3650d | yes | no |
| audit.audit_log | 36500d | yes | no |

Deletion execution: `privacy.service.ts:84-130` (single transaction; bearer of record).

---

## 6. Honest statuses / gaps

- `network` / `relay` backend modules **do not exist** — relay logic lives in `session/index.ts` + `access.ts` + `marketplace.repository.ts`. (NOT FOUND IN REPO as standalone modules.)
- MongoDB + WireGuard containers defined in compose with **no application consumer** — NOT APPLICABLE as data paths (verify against any future code).
- `analytics.session_telemetry` table has **no writer** in this repo (aggregate-only pipeline) — declarations ahead of implementation.
- Buyer-side location never persisted; seller location is Redis-geo (TTL-bound). No dedicated retention row for location data — LEGAL REVIEW REQUIRED.
- M-Pesa completion path has no auth/signature (alone among payment webhooks) — see ENVIRONMENT_SEPARATION Q5.