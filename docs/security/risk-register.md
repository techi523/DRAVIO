# DRAVIO — Consolidated Security/Operations Risk Register

> **One consolidated, evidence-traced register** merging every finding from every
> on-disk audit. Each row cites its source document + line(s). Nothing here is
> invented; rows only exist where a source doc recorded a finding.
>
> Sources merged (alphabetical):
> `backend/docs/security/auth-session-crypto-audit.md` (A-series, 2026-09-24),
> `docs/api-security-audit.md` (2026-09-20),
> `docs/compliance/aml-kyc-assessment.md`, `docs/compliance/compliance-matrix.md`,
> `docs/compliance/FINAL_COMPLIANCE_REPORT.md`,
> `docs/compliance/payment-security-scope.md`,
> `docs/compliance/kenya-communications-regulatory-assessment.md`,
> `docs/compliance/kenya-data-protection-assessment.md`,
> `docs/inventory/ASSET_INVENTORY.md`, `docs/inventory/DATA_LINEAGE.md`,
> `docs/inventory/ENVIRONMENT_SEPARATION.md`,
> `docs/operations/backups.md`, `docs/operations/disaster-recovery.md`,
> `docs/operations/monitoring-alerts.md`, `docs/operations/runbook.md`,
> `docs/security/data-lifecycle-audit.md` (D-series),
> `docs/security/incident-response-plan.md`,
> `docs/security/mobile-privacy-audit.md` (M-series),
> `docs/security/policy-integrity.md` (P-series),
> `docs/security/software-supply-chain.md` (S-series), `docs/production-audit.md`
> (A1–A46), `docs/testing/{TEST_RESULTS,SECURITY_RESULTS,MOBILE_RESULTS,FINAL_TEST_REPORT,PERFORMANCE_RESULTS}.md`,
> `docs/threat-model.md`.
>
> **Severity column = the source doc's own severity/status word.** Where a doc does
> not assign CRITICAL/HIGH/MEDIUM/LOW it uses its own status vocabulary (FAILED,
> PARTIAL, BLOCKED, MISMATCH, STALE-DOC, NOT VERIFIED…).
>
> **Owner values:** `team` = engineering, `prod-ops` = platform/ops, `counsel` =
> legal/DPO review, `qa` = test team, `EMERGENCY-VERIFIED` = item fixed **and**
> verified inside an emergency hardening pass (source doc's resolution matrix lists
> a verification step).
>
> **Status values:** the source doc's own status (OPEN / FIXED / PARTIAL /
> ACCEPTED RISK / BLOCKED / FAILED / RESOLVED / LEGAL REVIEW REQUIRED), plus
> register-level `DUPLICATE` (merged to another row: see EVIDENCE) and
> `SUPERSEDED` (a later source supersedes it).

---

## 1. Auth / session / cryptography & rate-limit — `backend/docs/security/auth-session-crypto-audit.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-001 | A-01 Cryptography | LOW | SECURITY | bcrypt cost 10 only; no argon2/scrypt, no pepper; entropy check = min(8) chars only | auth-session-crypto-audit.md:34 | bcryptjs hashes only, no plaintext | Raise cost ≥12 or argon2id; entropy policy at register | team | OPEN |
| R-002 | A-02 Cryptography | LOW | SECURITY | HS256 shared static JWT secret; no kid/rotation/asymmetric; 15m access / 30d refresh | auth-session-crypto-audit.md:35 | JWT_SECRET mandatory ≥32 chars, fail-fast | Add kid + versioned secret store; plan RS256/ES256; add jti | team | OPEN |
| R-003 | A-03 Cryptography | INFO | SECURITY | Refresh token stored as unsalted SHA-256 (64B input → not brute-forceable) | auth-session-crypto-audit.md:36 | randomBytes(64) input; hash-only storage | Optionally HMAC with pepper | team | OPEN |
| R-004 | A-04 Cryptography | INFO | SECURITY | Tunnel IP byte uses Math.random(); OTP/refresh use CSPRNG | auth-session-crypto-audit.md:37 | CSPRNG for tokens/OTP | Use crypto.randomInt(40,240) | team | OPEN |
| R-005 | A-05 TLS/DB | HIGH | SECURITY | **Prod Postgres ssl rejectUnauthorized:false — DB channel MITM-able** | auth-session-crypto-audit.md:38 | SSL used only when DATABASE_URL & NODE_ENV=prod | DATABASE_SSL_CA + rejectUnauthorized:true | team | OPEN |
| R-006 | A-06 Account recovery | HIGH | SECURITY | **No password reset / forgot-password flow exists** (grep none) | auth-session-crypto-audit.md:39 | — | POST /v1/auth/forgot + reset (32B single-use, 15m) | team | OPEN |
| R-007 | A-07 Account recovery | LOW | SECURITY | Mock OTP (test-only) logs the code; hard-gated NODE_ENV==='test' | auth-session-crypto-audit.md:40 | Twilio Verify in prod; 5-attempt single-use lockout tested | Keep hard-gate; never stdout in non-test | team | OPEN |
| R-008 | A-08 Account recovery | MEDIUM | SECURITY | Register returns EMAIL_ALREADY_EXISTS (400) → account enumeration; login uniform | auth-session-crypto-audit.md:41 | login/OTP uniform responses | Generic register response | team | OPEN |
| R-009 | A-09 Account recovery | MEDIUM | SECURITY | OTP login auto-provisions an account for any phone (identity = SIM possession); hardcodes country US | auth-session-crypto-audit.md:42 | role restricted BUYER/SELLER | Require verified email / explicit linking; fix country default | team | OPEN |
| R-010 | A-10 Session | HIGH | SECURITY | **Legacy refresh fallback re-issues 30d refresh with any still-valid access token — no rotation/revoke** | auth-session-crypto-audit.md:43 | primary refresh path rotates + revokes | Remove legacy path; require refresh_token; rate-limit; bind to device/IP | team | OPEN |
| R-011 | A-11 Session | INFO | SECURITY | Primary refresh rotation + revocation + reuse detection are correct | auth-session-crypto-audit.md:44 | revoke+lookup checks revoked/expires_at | (opt) grace-period reuse detection | team | ACCEPTED RISK |
| R-012 | A-12 Session | HIGH | SECURITY | **Suspend/ban/force_logout/revoke publish Kafka-only; authenticate() = jwtVerify only — enforcement cosmetic** | auth-session-crypto-audit.md:45 | logout revokes refresh; access 15m TTL | status check in authenticate; revokeAllUserTokens; jti deny-list | team | OPEN |
| R-013 | A-13 Session | LOW | SECURITY | No device/session inventory, unlimited concurrent sessions | auth-session-crypto-audit.md:46 | hashed tokens + rotation | per-user device table; GET/DELETE /v1/auth/sessions | team | OPEN |
| R-014 | A-14 Rate limiting | MEDIUM | PRIVACY | **Rate limit = global 200/min per-IP in-memory; register/OAuth/refresh/payment/admin have no route limit; no per-user limit; in-memory breaks multi-replica** | auth-session-crypto-audit.md:47 | login 5/m, otp/send 3/m, otp/verify 5/m | Redis store + ip+userId keyGenerator; per-user limits on register/refresh/withdraw | team | OPEN |
| R-015 | A-15 Fraud | MEDIUM | OPERATIONS | No persisted failure counters; fraud engine won't run by itself; risk score flags only IP 1.2.3.4; no refund/velocity checks | auth-session-crypto-audit.md:48 | evaluatePaymentRisk(failedCount>3) exists, admin-gated | persist login/OTP failures (Redis); wire consumer to real counters | team | OPEN |
| R-016 | A-16 Money | MEDIUM | OPERATIONS | **Withdraw front-runs disbursement: deducts wallet now, payout rail does not exist; $25k/req, no daily cap/KYC gate** | auth-session-crypto-audit.md:49 | honest no-rail disclosure message | escrow until real payout; caps + KYC | team | OPEN |
| R-017 | A-17 Payments | MEDIUM | SECURITY | **M-Pesa callback unauthenticated + unsigned (Safaricom signs nothing); caller knowing checkoutRequestID can force FAIL; provider_ref exposed to initiator** | auth-session-crypto-audit.md:50 | amount reconciliation ±5 KES + only-PENDING CAS; idempotency | Safaricom IP allow-list; opaque provider_ref; (opt) HMAC if operator allows | team | OPEN |
| R-018 | A-18 ISP | HIGH | SECURITY | **POST /v1/isp/:id/activate unauthenticated; customer_id+package_id from body → anonymous paid activation, burns operator money** | auth-session-crypto-audit.md:51 | adapter env-gated; reference idempotency | authenticate + role; derive customer_id from token | team | OPEN |
| R-019 | A-19 Secrets | HIGH | SECURITY | **ISP usage-webhook secret falls back to 'default_secret' — universal forgery token for billing webhooks** | auth-session-crypto-audit.md:52 | HMAC-SHA256 over body; timingSafeEqual | fail-fast if ISP_<ID>_SECRET unset; remove fallback | team | OPEN |
| R-020 | A-20 Secrets | INFO | SECURITY | env.ts validates JWT_SECRET ≥32 and secrets optional without defaults; fails fast | auth-session-crypto-audit.md:53 | strong fail-fast validation | (opt) DATABASE_URL required in prod; DATABASE_SSL_CA | team | ACCEPTED RISK |
| R-021 | A-21 Logging | LOW | PRIVACY | Full bodies logged: ISP webhook body, rule-engine fact.context; request URL only on 502 | auth-session-crypto-audit.md:54 | M-Pesa/ISP failures log err.message only | debug-level + sanitizeMetadata scrub; drop fact.context | team | OPEN |
| R-022 | A-22 Logging | LOW | PRIVACY | Facebook OAuth access_token sent as URL query param → proxy/log leak | auth-session-crypto-audit.md:55 | — | use codes.exchange / header auth | team | OPEN |
| R-023 | A-23 Time | INFO | SECURITY | Timestamps UTC/epoch consistently; no local-time drift found | auth-session-crypto-audit.md:56 | toISOString + epoch comparisons | (opt) timestamptz; confirm M-Pesa EAT semantics | team | OPEN |
| R-024 | A-24 Concurrency | INFO | SECURITY | Payment double-callback protection solid (CAS PENDING + tx credit + idempotency key) | auth-session-crypto-audit.md:57 | verified at SQL level | (opt) uniqueness on provider_ref | team | ACCEPTED RISK |
| R-025 | A-25 Billing | HIGH | OPERATIONS | **Usage-billing TOCTOU: committed counter advanced from Redis AFTER DB commit → concurrent reports may double-bill. NOT VERIFIED in code alone.** | auth-session-crypto-audit.md:58 | delta-based billing; duplicate report bills nothing | move counter update into the same DB tx / CAS-increment; concurrency regression test | team | OPEN |
| R-026 | A-26 Billing | MEDIUM | SECURITY | Usage-report & sessions/end never verify session ownership → known-token attacker drains wallet | auth-session-crypto-audit.md:59 | 32-char UUID session tokens | require session.userId === request.user.sub | team | OPEN |
| R-027 | A-27 RBAC | INFO | SECURITY | Admin RBAC correctly wired; ADMIN wildcard intentional; tested | auth-session-crypto-audit.md:60 | rbac.test.ts 401/403/ADMIN-wildcard | (opt) split wildcard | team | ACCEPTED RISK |
| R-028 | A-28 Audit | MEDIUM | COMPLIANCE | **Admin controllers hardcode adminId:'system-admin' → non-repudiation lost for money/security actions** | auth-session-crypto-audit.md:61 | emitAudit carries event | pass req.user.sub through every dispatch | team | OPEN |

## 2. Software supply chain — `docs/security/software-supply-chain.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-029 | Lockfile | RED | SUPPLY-CHAIN | **package-lock.json (root + backend) untracked (`gitignore:4`); deployments non-reproducible; CI npm ci aborts** | software-supply-chain.md:17-19,118-124 | lockfiles v3 + sha512 integrity available once committed | commit both lockfiles (P0); un-stick npm ci | team | OPEN |
| R-030 | fast-jwt | CRITICAL | SUPPLY-CHAIN | **fast-jwt@4.0.5 via @fastify/jwt@8.0.1: alg-confusion, empty-HMAC auth bypass, cache-key mixup (3×CVSS 9.1) — every service** | software-supply-chain.md:48,96 | — | overrides fast-jwt ≥6.2.4 or @fastify/jwt →10.2.2 (P0) | team | OPEN |
| R-031 | better-auth | CRITICAL | SUPPLY-CHAIN | **better-auth@1.4.18 via @neondatabase/auth@0.4.2-beta: refresh-token replay CVSS 9.1, account takeover x2 — admin-portal + buyer-web** | software-supply-chain.md:76,97 | — | pin better-auth ≥1.6.22 or @neondatabase/auth ≥0.5.0-beta (P0) | team | OPEN |
| R-032 | tar/bcrypt | CRITICAL | SUPPLY-CHAIN | **tar@6.2.1 via auth-service bcrypt→@mapbox/node-pre-gyp: traversal + DoS + stack-overflow (11 advisories)** | software-supply-chain.md:75,98 | node-gyp path only at install | replace bcrypt with bcryptjs (dropped dep present) (P1) | team | OPEN |
| R-033 | http-proxy | CRITICAL | SUPPLY-CHAIN | **@fastify/http-proxy@9.5.0: connection-header abuse strips proxy auth headers (CVSS 8.6) — gateway-service** | software-supply-chain.md:71,99 | — | bump to 11.6.2 (P1) | team | OPEN |
| R-034 | reply-from | CRITICAL | SUPPLY-CHAIN | @fastify/reply-from@9.8.0 reply-forwarding bypass + header strip (via http-proxy) | software-supply-chain.md:72,100 | — | via http-proxy bump | team | OPEN |
| R-035 | undici | HIGH | SUPPLY-CHAIN | undici@5.29.0: request smuggling, WS length-overflow, unbounded memory, CRLF (16 adv) via @firebase/*, reply-from, teeny-request | software-supply-chain.md:101 | — | source-fix via firebase/next majors (P2) | team | OPEN |
| R-036 | postcss | HIGH | SUPPLY-CHAIN | postcss@8.5.28 arbitrary .map read via sourceMappingURL via next@15.5.25 | software-supply-chain.md:102 | — | next →16.3.6 (P1) | team | OPEN |
| R-037 | fastify | HIGH | SUPPLY-CHAIN | fastify@4.29.1 content-type tab body-validation bypass + DoS; 4.x end-of-security-line | software-supply-chain.md:47,103 | helmet/CORS/rate-limit wired | major to 5.12.5 coordinated, with @fastify/* majors (P1) | team | OPEN |
| R-038 | find-my-way | HIGH | SUPPLY-CHAIN | find-my-way@8.2.2 HTTP/2 DDoS (CVSS 7.5) via fastify | software-supply-chain.md:104 | — | via fastify bump | team | OPEN |
| R-039 | uuid | MODERATE | SUPPLY-CHAIN | uuid@7.0.3 v3/v5/v6 buffer OOB (N/A if v4-only) | software-supply-chain.md:109 | — | uuid ≥11.1.1 (P2) | team | OPEN |
| R-040 | expo/ngrok | MODERATE | SUPPLY-CHAIN | expo@55.0.31 canary-range noise; audit 'fix' = downgrade 46.0.21 — do not apply blindly; @expo/ngrok no fix | software-supply-chain.md:79,110,173 | — | npx expo install --fix / SDK upgrade; review wireguard-VPN need (P2) | team | OPEN |
| R-041 | CI gate | N/A | SUPPLY-CHAIN | No CI dependency gate: no npm audit in pipeline, no Dependabot, no overrides | software-supply-chain.md:120,174 | secure defaults registry | after R-029: npm audit --audit-level=high + npm audit signatures + Dependabot (P3) | team | OPEN |
| R-042 | npm ls root | FAILED | SUPPLY-CHAIN | Root node_modules drifted (ELSPROBLEMS: 10 UNMET workspace links, extraneous pkgs); backend tree clean | software-supply-chain.md:20-21,122 | backend clean | npm ci from committed lockfile rebuilds | team | OPEN |
| R-043 | Typosquat | LOW | SUPPLY-CHAIN | No clones; low-fame/in-beta packages reviewed, all traceable; @dravio/* private + file: refs (confusion-safe) | software-supply-chain.md:148-156 | private scope; registry 404 for @dravio/backend | monitor react-native-wireguard-vpn + @neondatabase/auth beta | team | OPEN |

## 3. Mobile security & privacy — `docs/security/mobile-privacy-audit.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-044 | M-01 Tokens | INFO | MOBILE | Tokens in SecureStore (Keystore/Keychain); no AsyncStorage; allowBackup=false; single-token design | mobile-privacy-audit.md:25 | Positive control | keep; split access/refresh if backend issues both | team | OPEN |
| R-045 | M-02 Web storage | MEDIUM | MOBILE/PRIVACY | Web build keeps tokens/user/device_id in localStorage (XSS-readable) | mobile-privacy-audit.md:26 | SecureStore only on native | httpOnly SameSite cookies on web | team | OPEN |
| R-046 | M-03 Biometric | LOW | MOBILE | SecureStore w/o requireAuthentication; biometric/2FA toggles are cosmetic flags — users misled | mobile-privacy-audit.md:27 | — | requireAuthentication + real 2FA or hide toggles | team | OPEN |
| R-047 | M-04 Pinning | LOW | MOBILE | No cert pinning; stock fetch/socket.io; cleartext off in main manifest | mobile-privacy-audit.md:33 | usesCleartextTraffic=false | (opt) okhttp pinning via expo-build-properties | team | OPEN |
| R-048 | M-05 Deep links | MEDIUM | MOBILE | dravio:// and https://dravio.app/open registered + autoVerify, but no linking config; dead, untested surface; assetlinks NOT VERIFIED | mobile-privacy-audit.md:40 | no handler → no injection today | implement linking w/ allow-list + auth, or remove filters | team | OPEN |
| R-049 | M-06 WebView | INFO | MOBILE | No WebView anywhere; only system-browser links | mobile-privacy-audit.md:46 | Positive control | preserve | team | OPEN |
| R-050 | M-07 Clipboard | INFO | MOBILE | No clipboard use of tokens/refs | mobile-privacy-audit.md:52 | Positive control | preserve | team | OPEN |
| R-051 | M-08 Logging | LOW | MOBILE/PRIVACY | Unconditional console.* survives in prod (VpnManager context/error objects); no redaction strategy | mobile-privacy-audit.md:58 | no tokens/passwords logged | strip console.* in prod; sanitized telemetry sink | team | OPEN |
| R-052 | M-09 Screenshots | MEDIUM | PRIVACY | **No FLAG_SECURE: wallet balance, M-Pesa phone, relay key, live sessions visible in recents/screenshots (Android + iOS snapshots)** | mobile-privacy-audit.md:64 | — | FLAG_SECURE + iOS snapshot masking on Wallet/Session/Relay | team | OPEN |
| R-053 | M-10 Firebase | HIGH | MOBILE | **google-services.json is a fake placeholder compiled in (build.gradle:184); store builds non-functional for Google sign-in/push; eas.projectId is a slug** | mobile-privacy-audit.md:70 | — | real Firebase project; keys outside VCS; fix projectId | team | OPEN |
| R-054 | M-11 Signing | CRITICAL | MOBILE | **Release APK/AAB signed with public Android debug key; Play rejects; anyone with debug keystore can sign updates** | mobile-privacy-audit.md:76 | — | generate release keystore; CI secrets; release signingConfig | team | OPEN |
| R-055 | M-12 Account deletion | HIGH | MOBILE/COMPLIANCE | **No in-app account deletion; ToS claims it exists (false) → Play + Apple store rejection** | mobile-privacy-audit.md:77 | backend DSAR API exists | in-app deletion + hosted web fallback wired to backend | team | OPEN |
| R-056 | M-13 Versioning | MEDIUM | MOBILE | versions frozen at 1 / versionCode 1; no submit pipeline | mobile-privacy-audit.md:78 | — | EAS autoIncrement + submit step | team | OPEN |
| R-057 | M-14 OTA | MEDIUM | MOBILE | expo-updates enabled w/o code signing, non-pinned host → malicious JS push at launch if Expo project compromised | mobile-privacy-audit.md:79 | — | codeSigningCertificate + pinned/digitally-signed OTA | team | OPEN |
| R-058 | M-15 DSAR UX | HIGH | PRIVACY | **Legal.tsx promises access/correct/delete/export; zero in-app export/download/delete; contact = unverified mailbox** | mobile-privacy-audit.md:85 | backend DSAR endpoints exist | DSAR screen wired to backend; email/ack automation | team | OPEN |
| R-059 | M-16 Permissions | MEDIUM | MOBILE | Merged manifest ships SYSTEM_ALERT_WINDOW + legacy READ/WRITE_EXTERNAL_STORAGE (unused); POST_NOTIFICATIONS w/o impl | mobile-privacy-audit.md:92 | no location/camera/contacts requested | strip unused perms; audit library manifests | team | OPEN |
| R-060 | M-17 a11y | MEDIUM | MOBILE | Wallet/Relay/Marketplace/Profile controls lack labels/roles; 8-13px 0.5-alpha text fails WCAG AA; sub-44px targets | mobile-privacy-audit.md:99 | good baseline on login/register/VpnDisclosure | labels/roles, ≥4.5:1 contrast, ≥44pt targets | team | OPEN |
| R-061 | M-18 Logout | MEDIUM | MOBILE | **logout() leaves WireGuard tunnel + billing session open; next login can resume prior user's metered session** | mobile-privacy-audit.md:105 | server end-call best-effort | logout must disconnect + end session + clear dravio_active_session | team | OPEN |
| R-062 | M-19 Device ID | MEDIUM | MOBILE/PRIVACY | Persistent dravio_device_id transmitted as billing hardwareId; privacy text claims "no device identifiers" — inaccurate (table MEDIUM; summary counts HIGH — self-inconsistent doc) | mobile-privacy-audit.md:86,116-118 | — | disclose in policy/Data Safety; rotation/opt-out | team | OPEN |
| R-063 | M-20 Location | INFO | MOBILE/PRIVACY | No location permission; geo copy exists but always lat/lon 0 — clean posture | mobile-privacy-audit.md:93 | no location collected | preserve; consent+usage if added | team | OPEN |
| R-064 | M-20b Hygiene | LOW | SUPPLY-CHAIN | logcat.txt (5.16 MB, LAN endpoint) + screen.png committed; .gitignore misses them | mobile-privacy-audit.md:106 | — | delete + gitignore | team | OPEN |

## 4. Environment separation — `docs/inventory/ENVIRONMENT_SEPARATION.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-065 | Q1 Env definition | FAILED | OPERATIONS | **No staging value in NODE_ENV; only .env.production.template; deploy-staging is a no-op echo; no env 'like prod but not prod'** | ENVIRONMENT_SEPARATION.md:7-20 | single prod manifests | build real staging tier + env matrix | prod-ops | OPEN |
| R-066 | Q2 Cross-env leak | FAILED | OPERATIONS | **Two live-ish prod API hostnames (api.dravio.com vs api.dravio.app) UNCONFIRMED; *.vercel.app wildcard CORS lets any Vercel branch call prod API; admin-service origin:true; MPESA_ENV sandbox default; dravio_production DB name shared everywhere; shared Neon cookie fallback; shared-ts 'super-secret'** | ENVIRONMENT_SEPARATION.md:26-43 | JWT_SECRET fail-fast; Render sync:false secrets | consolidate hostnames; exact-origin CORS; force MPESA_ENV; rename dev DB | prod-ops | OPEN |
| R-067 | Q3 Config truth | FAILED | OPERATIONS | 4+ overlapping env sources disagree (env.ts vs .env.production.template vs render.yaml vs railway.json/start-all.sh); OTEL vars declared but no instrumentation | ENVIRONMENT_SEPARATION.md:47-59 | — | single source of truth + deploy manifest audit | prod-ops | OPEN |
| R-068 | Q4 Secrets | PARTIAL/FAILED | COMPLIANCE | Committed secret material: start_local_dev.ps1 prod-named JWT secret; CI test JWT secret; Neon cookie fallback literal; shared-ts super-secret; Firebase placeholder | ENVIRONMENT_SEPARATION.md:63-79 | no real provider creds committed; no .env committed | purge placeholders; CI secrets only | team | OPEN |
| R-069 | Q5 Test isolation | FAILED | OPERATIONS | **Root Playwright e2e DEFAULTs to production URLs and asserts live prod /health; 'integration' can target api.dravio.app; unauth M-Pesa callback completes PENDING tx** | ENVIRONMENT_SEPARATION.md:83-97 | unit tests offline; M-Pesa replay-safe | hard guard against prod targets in tests; target staging only | qa | OPEN |
| R-070 | Q6 Auditability | FAILED | OPERATIONS | No tracing/observability; /health doesn't identify env; ArgoCD points to wrong repo (dravio/platform.git) | ENVIRONMENT_SEPARATION.md:101-108 | — | instrumentation; env-identifying health; fix ArgoCD | prod-ops | OPEN |

## 5. Asset inventory findings — `docs/inventory/ASSET_INVENTORY.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-071 | ArgoCD | FAILED | DEPLOYMENT | ArgoCD application points at `github.com/dravio/platform.git` — repo mismatch with origin techi523/DRAVIO; auto-prune/self-heal configured | ASSET_INVENTORY.md:114-115 ; ENVIRONMENT_SEPARATION.md:108 | — | fix repoURL or remove ArgoCD | prod-ops | OPEN |
| R-072 | Proxy/CORS legacy | PARTIAL | OPERATIONS | gateway-service wildcard CORS `*.vercel.app`; admin-service old plane allows all origins (origin:true) | ASSET_INVENTORY.md:104-105 ; ENVIRONMENT_SEPARATION.md:33-34 | backend CORS allowlist | decommission legacy services/* trees | prod-ops | DUPLICATE of R-066 |
| R-073 | Mongo/WG/Terraform | PARTIAL | OPERATIONS | MongoDB + WireGuard containers defined with NO application consumer; network/relay module NOT FOUND (logic in session/marketplace); qa-suite + vpc terraform present | ASSET_INVENTORY.md:125-126,141-142 ; DATA_LINEAGE.md:127-128 | — | reconcile compose to reality or delete | team | OPEN |
| R-074 | Two hostnames | UNCONFIRMED | DEPLOYMENT | Web→api.dravio.com vs mobile→api.dravio.app (eas.json:24); cannot consolidate without live inspection | ASSET_INVENTORY.md:151 ; ENVIRONMENT_SEPARATION.md:32 | — | confirm live DNS, pick one canonical API FQDN | prod-ops | DUPLICATE of R-066 |

## 6. Data lineage — `docs/inventory/DATA_LINEAGE.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-075 | Location retention | LEGAL REVIEW REQUIRED | PRIVACY | Seller geo (Redis active_sellers_geo) has no retention-registry category; consent for seller location listing undocumented | DATA_LINEAGE.md:78,130 | Redis TTL 300s only lifecycle | counsel opinion + registry row | counsel | LEGAL REVIEW REQUIRED |
| R-076 | Telemetry writer | PARTIAL | OPERATIONS | analytics.session_telemetry table has NO writer in repo (declared-ahead) | DATA_LINEAGE.md:129 | only aggregates.metrics written | add writer or drop table | team | OPEN |
| R-077 | Provider copies | LEGAL REVIEW REQUIRED | PRIVACY | Stripe metadata (incl phone_number), M-Pesa, Twilio, OAuth, Cloudinary copies of personal data; no DPAs in repo | DATA_LINEAGE.md:19 ; kenya-data-protection-assessment.md:91 | — | process agreements + transfer safeguards | counsel | LEGAL REVIEW REQUIRED |
| R-078 | Kafka retention | UNKNOWN/LEGAL REVIEW REQUIRED | COMPLIANCE | Broker location/retention not configurable from repo; audit trail durability = Kafka availability | DATA_LINEAGE.md:102 ; FINAL_COMPLIANCE_REPORT.md:177 | same-DB transaction_events survive | durable local audit fallback | prod-ops | OPEN |
| R-079 | M-Pesa path | MEDIUM | SECURITY | M-Pesa completion path has no auth/signature — alone among payment webhooks | DATA_LINEAGE.md:131 | amount reconciliation + PENDING CAS | see R-017 | team | DUPLICATE of R-017 |

## 7. Data lifecycle (export & deletion) — `docs/security/data-lifecycle-audit.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-080 | D-01 Export | HIGH | PRIVACY | No export/download endpoint; only reviewer-produced ACCESS envelope in JSONB | data-lifecycle-audit.md:177 | envelope leak-checked (no creds, no other-user data) | user-facing shaped export (JSON/CSV) | team | OPEN |
| R-081 | D-02 Portability | HIGH | PRIVACY | PORTABILITY promised deliverable:'file' but returns same in-memory envelope as ACCESS | data-lifecycle-audit.md:178 | — | bounded machine-readable export | team | OPEN |
| R-082 | D-03 Rights count | INFO | COMPLIANCE | Code implements 5 of '6' DSAR rights (no RESTRICT/EXPORT); docs/task frame mismatch | data-lifecycle-audit.md:179 | — | reconcile docs to 5 (or add 6th) | team | MATCH |
| R-083 | D-04 Envelope leak-safety | LOW | PRIVACY | Envelope excludes password hash, refresh tokens, provider_id, session_token, env secrets | data-lifecycle-audit.md:180 | verified | add regression assertions | qa | CLOSED |
| R-084 | D-05 Self-scoping | LOW | SECURITY | Envelope reachable only by requester; cross-subject read requires ADMIN/BILLING_ADMIN | data-lifecycle-audit.md:181 | ownership-guarded GET | add cross-user GET → 404 test | qa | MATCH |
| R-085 | D-06 Routing deletion | HIGH | PRIVACY | Deletion plan names phantom table `sessions.routing`; real routing (sessions.sessions raw UUIDs, Redis session:* buyer UUID) left untouched | data-lifecycle-audit.md:183 | — | rewrite plan to real stores; pseudonymize routing + Redis keys | team | OPEN |
| R-086 | D-07 Wallet forfeiture | HIGH | PRIVACY | DELETION deletes billing.wallets regardless of non-zero balance/escrow — funds forfeited, no guard/payout | data-lifecycle-audit.md:184 | — | block/flag deletion while balance>0; payout first | team | OPEN |
| R-087 | D-08 Sessions survive | HIGH | PRIVACY | Deleted accounts keep active sessions running (billing.sessions ACTIVE, Redis 24h, access JWT ≤15m) | data-lifecycle-audit.md:185 | — | terminate sessions, purge Redis keys, invalidate tokens at deletion | team | OPEN |
| R-088 | D-09 DSAR PII copies | CRITICAL | PRIVACY/COMPLIANCE | **Deletion leaves full PII copies in compliance.privacy_requests (payload+envelope), policy_acceptances (ip/UA), provider_intake (verification JSON)** | data-lifecycle-audit.md:186 | — | shred/SQL-erasable entries for the 3 compliance tables | team | OPEN |
| R-089 | D-10 hardware_id | MEDIUM | PRIVACY | Plan promises hardware_id → DELETED marker; code rewrites only customer_id | data-lifecycle-audit.md:187 | — | rewrite hardware_id; align comment & code | team | OPEN |
| R-090 | D-11 Audit PII | MEDIUM | COMPLIANCE | sanitizeMetadata redacts token/password-style only; phone_number/email persist in audit metadata for 36500 days | data-lifecycle-audit.md:188 | redaction exists | scrub phone/email/full_name; document deliberate retention | counsel | PARTIAL |
| R-091 | D-12 Deletion event | MEDIUM | COMPLIANCE | No `account.deleted` action; deletion event emitted after commit, Kafka-optional → vanishes if Kafka absent | data-lifecycle-audit.md:189 | privacy_requests row is durable record | emit account.deleted + durable local fallback | team | OPEN |
| R-092 | D-13 Raw UUIDs | LOW | PRIVACY | Retained financial stores keep raw user UUIDs (inert but present); legal-adequacy Q open | data-lifecycle-audit.md:190 | no FK join rows survive | counsel review; consider deleted: markers | counsel | PARTIAL |
| R-093 | D-14 Erasure atomic | LOW | PRIVACY | Erasure all-or-nothing; CAS state machine sound | data-lifecycle-audit.md:191 | verified | add rollback-on-mid-plan-failure test | qa | MATCH |
| R-094 | D-15 Privacy rate-limit | INFO | SECURITY | No rate limit on /v1/privacy/* (contrast login/OTP) → spam/DoS surface | data-lifecycle-audit.md:192 | — | add config.rateLimit to privacy routes | team | OPEN |
| R-095 | D-16 Envelope retention | LOW | PRIVACY | The exported envelope itself is retained PII in privacy_requests.outcome for row lifetime | data-lifecycle-audit.md:193 | — | TTL/shred outcome after delivery | team | OPEN |
| R-096 | D-17 App wiring | INFO | PRIVACY | No app calls /v1/privacy/* (only static Legal.tsx pages) → physical users cannot request export/deletion (ties to app-store mandate) | data-lifecycle-audit.md:194 | DSAR system functional server-side | wire into mobile + buyer-web (see app-store-readiness / M-12, M-15) | team | BLOCKED |

## 8. Policy/terms/privacy integrity — `docs/security/policy-integrity.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-097 | P-01 AUP per-session | PARTIAL | COMPLIANCE | AUP framed as 'condition of every session' but no per-session AUP gate wired | policy-integrity.md:19 | session gate requires auth+price+balance | decide & wire or soften wording | counsel | OPEN |
| R-098 | P-04 'pseudonymized' claim | MISMATCH | PRIVACY | AUP claims financial records 'pseudonymized rather than deleted'; no retained column rewritten, raw UUIDs kept, DSAR tables keep PII | policy-integrity.md:22 | — | correct policy text to match code (see R-092) | counsel | OPEN |
| R-099 | P-06/P-21 linkage | PARTIAL | PRIVACY | 'personal linkage broken' — identity join removed but raw UUIDs / DSAR PII remain | policy-integrity.md:24,39 | — | counsel adequacy decision | counsel | OPEN |
| R-100 | P-15 registration consent | MISMATCH | COMPLIANCE | buyer-terms A.1 'by creating account you agree' — no consent capture at registration; REGISTER gate defined not enforced | policy-integrity.md:33 ; compliance-matrix.md:35 | purchase gate works (PASS) | pre-auth acceptance flow or lawful-basis rationale | team | OPEN |
| R-101 | P-16 'delete at any time' | PARTIAL | PRIVACY | Deletion requires reviewer-approved request; no self-service; erasure incomplete (D-06..D-10) | policy-integrity.md:34 | backend DSAR exists | in-app deletion + complete erasure | team | OPEN |
| R-102 | P-20 stale gap note | STALE-DOC | COMPLIANCE | provider-terms 'Known gaps' preserves pre-fix '1-3 business days' text contradicting honest message at wallet.routes.ts:94 | policy-integrity.md:38 | code already honest | fix doc text | team | OPEN |
| R-103 | P-22 'anonymised' heartbeats | MISMATCH | PRIVACY | buyer-web Privacy claims seller heartbeats 'anonymised'; stored keyed by seller_id w/ relay+geo+price | policy-integrity.md:40 | — | correct text | counsel | OPEN |
| R-104 | P-23/P-25 retention claims | MISMATCH | PRIVACY | Privacy screens claim 12 months / 'as long as account exists'; registry says 3650d/730d | policy-integrity.md:41,43 | retention registry is source of truth | align app text with registry | team | OPEN |
| R-105 | P-24 deletion any time | PARTIAL | PRIVACY | Request creatable but fulfillment reviewer-gated + incomplete erasure | policy-integrity.md:42 | — | see R-101 | team | DUPLICATE of R-101 |
| R-106 | P-26/P-29 in-app deletion | MISMATCH/BLOCKED | MOBILE/COMPLIANCE | Mobile Terms/Privacy promise delete + export in-app; no such control in any app; Profile.tsx has no delete | policy-integrity.md:44,47 | DSAR API backend | build in-app deletion/export (M-12/M-15) | team | OPEN |
| R-107 | P-27 'paid out weekly' | MISMATCH | COMPLIANCE | Mobile Terms promise weekly payouts; payouts are non-functional rows-only | policy-integrity.md:45 | API text already honest (wallet.routes.ts:94) | remove fabricated timeline from Terms | team | OPEN |
| R-108 | P-28 fee 'displayed at transaction' | MISMATCH | COMPLIANCE | Fee disclosed via API only, no transaction-time UI anywhere | policy-integrity.md:46 | fee-disclosure endpoint PASS | buyer-visible breakdown before purchase | team | OPEN |
| R-109 | P-30 age gate | PARTIAL | PRIVACY | Terms claim 16+; no DOB/age collected — cannot evidence 'no children' | policy-integrity.md:48 | AUP honestly states no mechanism | age gate or counsel determination | counsel | OPEN |
| R-110 | P-32/P-33 vendor/encryption claims | UNVERIFIABLE | COMPLIANCE | 'Infrastructure providers under strict agreements' / 'TLS1.3 + AES-256 at rest' — no processor list, no TLS/at-rest config in repo | policy-integrity.md:50-51 | — | correct claims or provide evidence | counsel | OPEN |
| R-111 | P-34 accept-on-register | MISMATCH | COMPLIANCE | All docs say 'you accept when you register'; register un-gated | policy-integrity.md:52 | — | see R-100 | team | DUPLICATE of R-100 |
| R-112 | S-01..S-04 store posture | BLOCKED | MOBILE/COMPLIANCE | Account deletion (Play data-safety / Apple 5.1.1(v)) BLOCKED; data-category disclosure PARTIAL; privacy URL PARTIAL | policy-integrity.md:61-64 | — | see app-store-readiness.md | team | OPEN |

## 9. Compliance (Kenya DPA / CA / AML / PCI / store) — `docs/compliance/*`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-113 | D-01 records of processing | PARTIAL | COMPLIANCE | Inventory exists as docs/schema but no formal records-of-processing register | kenya-data-protection-assessment.md:81 ; compliance-matrix.md:33 | — | build maintained RoPA | counsel | OPEN |
| R-114 | D-02 lawful basis | LEGAL REVIEW REQUIRED | COMPLIANCE | Draft bases only; no LI balancing test; geo/OTP/OAuth bases not evidenced | compliance-matrix.md:34 ; kenya-data-protection-assessment.md:82 | — | counsel validation | counsel | LEGAL REVIEW REQUIRED |
| R-115 | D-03 / I-05/I-06 consent+email+KYC | FAIL | COMPLIANCE | Consent capture at registration FAIL; email verification FAIL; KYC vestigial/no pipeline FAIL | compliance-matrix.md:35,58-61 ; aml-kyc-assessment.md:96-102 ; FINAL_COMPLIANCE_REPORT.md:32-34 | purchase-gate PASS | consent-at-register flow; app-surfaced KYC & email verification | team | OPEN |
| R-116 | D-09 retention schedule | PARTIAL | COMPLIANCE | 15 categories seeded but registry durations are config, not legal minimums | compliance-matrix.md:41 | register + enforcement layer | counsel approve durations | counsel | OPEN |
| R-117 | D-10 cross-border | UNKNOWN | COMPLIANCE | Transfers to Stripe/Twilio/OAuth(US)/Safaricom not evidenced; no safeguards | compliance-matrix.md:42 ; FINAL_COMPLIANCE_REPORT.md:80-82 | — | DPAs + transfer impact assessment | counsel | UNKNOWN |
| R-118 | D-11 breach notification | LEGAL REVIEW REQUIRED | COMPLIANCE | No breach-notification timeline exists; none asserted | compliance-matrix.md:43 ; FINAL_COMPLIANCE_REPORT.md:85-89 | IRP keeps it LEGAL REVIEW REQUIRED | counsel + regulator confirm | counsel | LEGAL REVIEW REQUIRED |
| R-119 | D-12 ODPC/DPO | LEGAL REVIEW REQUIRED | COMPLIANCE | No ODPC registration, no DPO designation | compliance-matrix.md:44 ; FINAL_COMPLIANCE_REPORT.md:110-111 | — | counsel classification; register if required | counsel | LEGAL REVIEW REQUIRED |
| R-120 | D-13 encryption at rest/in transit | PARTIAL | COMPLIANCE | HTTPS assumed at termination; no in-repo TLS config; at-rest encryption unverifiable | compliance-matrix.md:45 ; policy P-33 | helmet + CORS | verify platform TLS + disk encryption; A-05 | prod-ops | OPEN |
| R-121 | D-17/D-18 audit durability & SIEM | FAIL | OPERATIONS | Audit depends on Kafka; degrades silently; log shipping/SIEM absent | compliance-matrix.md:49-50 ; runbook.md:249-250 | same-DB transaction_events | durable audit fallback + log shipping | prod-ops | OPEN |
| R-122 | I-08 admin provisioning | PARTIAL | COMPLIANCE | Admin roles DB-seeded/CLI only; not exposed via API (good) but undocumented | compliance-matrix.md:63 | no public admin creation | document process | team | OPEN |
| R-123 | P-16 payouts | BLOCKED | COMPLIANCE | **Payouts/disbursement BLOCKED — rows-only; no rail; creates reconciliation/consumer-protection exposure** | compliance-matrix.md:84 ; payment-security-scope.md:100-113 ; aml-kyc-assessment.md:58-63 | honest disclosure in code | provider onboarding (Stripe Connect / Safaricom B2C) | prod-ops | BLOCKED |
| R-124 | P-18 M-Pesa prod switch | PARTIAL | OPERATIONS | MPESA_ENV defaults sandbox; sandbox base URL still the fallback — silent degrade | compliance-matrix.md:86 ; payment-security-scope.md:65-69 | — | force/assert MPESA_ENV=production | prod-ops | OPEN |
| R-125 | P-20 FX static | PARTIAL | COMPLIANCE | Static USD_TO_KES 155 used for reconciliation incl. ±5 KES tolerance | compliance-matrix.md:88 | — | FX source + revalidation | counsel | OPEN |
| R-126 | T-03 acceptance UI | FAIL | COMPLIANCE | No app UI calls acceptance/fee-disclosure/privacy endpoints | compliance-matrix.md:96 ; FINAL_COMPLIANCE_REPORT.md:174-175 | backend complete | ship UIs | team | OPEN |
| R-127 | T-04 SELL gate | PARTIAL | COMPLIANCE | provider_terms SELL gate defined but not enforced on listing/publish endpoints | compliance-matrix.md:97 ; policy-integrity.md:37 | heartbeat role-gate only | enforce acceptance + approval on publish | team | OPEN |
| R-128 | S-02/S-03 sanctions | LEGAL REVIEW REQUIRED | COMPLIANCE | Country-restriction gate exists/empty by design; no PEP screening; no list activated | compliance-matrix.md:104-106 ; aml-kyc-assessment.md:45-52 | intake assertCountryAllowed wired | counsel choose enabled lists | counsel | LEGAL REVIEW REQUIRED |
| R-129 | AML monitoring | FAIL | COMPLIANCE | No transaction monitoring / velocity / risk-scoring; evaluateRiskScore dead code; no SAR/STR/CTR | aml-kyc-assessment.md:37-42,96-107 | application caps ($25k, $100k) only | wire monitoring + thresholds per counsel | team | OPEN |
| R-130 | KYC/KYB | FAIL | COMPLIANCE | kyc_level vestigial; intake declarative; mock 'identity verification' compliance UI is decorative (fake rows) | aml-kyc-assessment.md:29-33,96 | intake schema exists | real verification pipeline or remove fake UI | team | OPEN |
| R-131 | PCI scope | LEGAL REVIEW REQUIRED | COMPLIANCE | Card data never enters DRAVIO (hosted checkout) incl. metadata; SAQ determination contract-dependent | payment-security-scope.md:25-35 | PAN/CVV never stored; webhook verify PASS | SAQ with PSP contract + QSA | counsel | LEGAL REVIEW REQUIRED |
| R-132 | AML/CA classification | LEGAL REVIEW REQUIRED | COMPLIANCE | Is DRAVIO a POCAMLA reporting institution / CA licensable reseller? Open Qs | FINAL_COMPLIANCE_REPORT.md:66-69,73-75 ; kenya-communications-regulatory-assessment.md:44-77 ; aml-kyc-assessment.md:110-121 | honest provisional buckets | CA/FRC/counsel determination | counsel | LEGAL REVIEW REQUIRED |

## 10. Operations — backups/monitoring/DR/runbook

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-133 | Backups | #1 BLOCKER | OPERATIONS | **NO dump/WAL/restore/off-host storage exists; single PG volume = permanent data loss; RPO ≈ entire dataset** | backups.md:3-13,30-33 ; disaster-recovery.md:38-41 | schema recoverable from git (idempotent migrations) | daily pg_dump → off-host; WAL archiving; restore drill + smoke | prod-ops | FAILED |
| R-134 | Monitoring/alerting | NOT VERIFIED | OPERATIONS | **No alerting stack, no SIEM, no paging; detection = manual log grep** | monitoring-alerts.md:3-19 ; incident-response-plan.md:92-96 | Fastify info logs + audit pipeline exist | cron/CI check scripts → webhook/email; prom-client; readiness | prod-ops | FAILED |
| R-135 | /health completeness | PARTIAL | OPERATIONS | **/health returns 200 while DB/Redis/Kafka down — no dependency probe; readiness missing** | monitoring-alerts.md:11-15 ; disaster-recovery.md:171 | Docker HEALTHCHECK polls /health | SELECT 1 + PING readiness inside /health | team | OPEN |
| R-136 | RTO/RPO | ESTIMATE ONLY | OPERATIONS | RTO/RPO figures are estimates, not measured; must not be shown as commitments; re-baseline after alerting+backups | disaster-recovery.md:13-21 | — | measure via drills once backups+alerting exist | prod-ops | OPEN |
| R-137 | Migration runner | UNTESTED | OPERATIONS | No versioned migration runner; hand-applied idempotent SQL; last-applied state unknowable | runbook.md:394-399 ; disaster-recovery.md:161 | migrations idempotent (IF NOT EXISTS) | migration runner + schema-state tracking | team | OPEN |
| R-138 | Rollback | UNTESTED | OPERATIONS | No rollback automation/canary/feature flags/registry retention | runbook.md:373-379 | re-deploy previous build possible | rollback+canary automation | prod-ops | OPEN |
| R-139 | TLS certs/DNS | NOT VERIFIED | OPERATIONS | No cert automation, no expiry monitor; DNS records not provable; app has no IP fallback | runbook.md:422-428,444-446 ; disaster-recovery.md:110-132 | platform-managed domains | expiry alert; document authoritative records | prod-ops | OPEN |
| R-140 | DB live prove-out | BLOCKED | OPERATIONS | Postgres/Redis never run live on host (WSL2/VM reboot pending); all DB statuses VERIFIED-BY-CONSTRUCTION only | runbook.md:24-29 ; disaster-recovery.md:150-153 ; MOBILE_RESULTS.md:152-157 | schema in git | provision + prove out; seed; run integration suites | prod-ops | BLOCKED |
| R-141 | CI npm ci | PARTIAL | SUPPLY-CHAIN | CI `npm ci` fails at root (untracked lockfile) → lint/test/build jobs cannot pass today | runbook.md:363-365 ; software-supply-chain.md:119 | — | commit lockfiles (R-029) then CI passes | team | DUPLICATE of R-029 |

## 11. Incident-response readiness — `docs/security/incident-response-plan.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-142 | Contact placeholders | N/A | OPERATIONS | On-call roster, escalation tree, bridge, IC/billing/DPO/counsel all `<PLACEHOLDER>` | incident-response-plan.md:18-27 | plan skeleton + severities defined | fill real contacts before shipping | prod-ops | OPEN |
| R-143 | DSAR reviewer role | OPEN | OPERATIONS | privacy DSAR reviewer (ADMIN/BILLING_ADMIN) must be provisioned pre-incident; not yet done | incident-response-plan.md:105,113 | API exists | provision + test role | prod-ops | OPEN |
| R-144 | Breach comms | LEGAL REVIEW REQUIRED | COMPLIANCE | No timeline may be communicated until counsel determines requirement | incident-response-plan.md:104 | plan enforces this | counsel confirm | counsel | DUPLICATE of R-118 |
| R-145 | Drill cadence | OPEN | OPERATIONS | Plan requires quarterly tabletop + biannual simulated containment; none recorded as executed | incident-response-plan.md:108-113 | plan defines drills | schedule + log first drill | prod-ops | OPEN |

## 12. Testing / verification gaps — `docs/testing/*`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-146 | Web E2E | BLOCKED | QA | Playwright web E2E blocked — no reachable backend; and suite defaults to production URLs (prod-smoke risk) | FINAL_TEST_REPORT.md:13 ; TEST_RESULTS.md:74-76 ; ENVIRONMENT_SEPARATION.md:89-92 | unit suites offline | reachable staging backend; guard prod targets | qa | BLOCKED |
| R-147 | Integration/API/DB | BLOCKED | QA | API/integration/database suites blocked — no backend/.env, no Postgres/Redis | FINAL_TEST_REPORT.md:14 ; TEST_RESULTS.md:77-78 | — | provision infra + .env | qa | BLOCKED |
| R-148 | Security-live | BLOCKED | QA | Live JWKS / BOLA / rate-limit verification blocked (needs API+DB) | SECURITY_RESULTS.md:44-49 ; FINAL_TEST_REPORT.md:15 | pure-layer security tests PASS (37/37) | provision, then execute listed live checks | qa | BLOCKED |
| R-149 | Payments-live | BLOCKED | QA | Stripe/M-Pesa gateway E2E blocked — no credentials/webhook tunnel | FINAL_TEST_REPORT.md:16 ; TEST_RESULTS.md:80 | signature/reconciliation logic by-construction | test keys + tunnel | qa | BLOCKED |
| R-150 | Relay/tunnel E2E | BLOCKED | QA | No registered relay_endpoint/public_key → tunnel E2E impossible | FINAL_TEST_REPORT.md:17 ; MOBILE_RESULTS.md:34 | config fail-closed tested | provision a real seller relay | qa | BLOCKED |
| R-151 | Performance benchmarks | BLOCKED | QA | Round-trip/throughput/DB-query-plan/relay-bandwidth not benchmarked; no synthetic numbers | PERFORMANCE_RESULTS.md:27-30 | device samples only | benchmark after infra | qa | BLOCKED |

## 13. Threat-model residual risks — `docs/threat-model.md` / `docs/api-security-audit.md`

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | MITIGATION/CONTROL ALREADY PRESENT | RECOMMENDED ACTION | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| R-152 | Fraud engine | ACCEPTED RISK | OPERATIONS | Fraud remains rule-based, admin-gated; no live OTP/fraud blocking on payments | threat-model.md:55-57 | rules + admin endpoints | live monitoring integration (R-129) | team | ACCEPTED RISK |
| R-153 | per_hour pricing | ACCEPTED RISK | OPERATIONS | per-MB/`per_hour` sellers rejected (503) instead of guessed | threat-model.md:61-62 | fail-closed | support or document | team | ACCEPTED RISK |
| R-154 | API endpoints | INFO | SECURITY | Endpoint-by-endpoint posture currently OK (no public data exposure; RBAC wired; topup removed) | api-security-audit.md:5-60 | verified pass 2026-09-20 | keep regression checks (security-checklist.md quarterly bores) | qa | OPEN |

## 14. Production-audit hardening history (A1–A46) — `docs/production-audit.md`

> All rows below are the source doc's own resolution statuses (FIXED for verification-executed items, RESOLVED for documented opt-ins, PARTIAL for deferred items). They are the **keeper rows** the reintroduction-prevention rule in `vulnerability-management.md` protects.

| ID | AREA | SEVERITY | CLASS | DESCRIPTION | EVIDENCE (doc:line) | RECOMMENDED ACTION (post-status) | OWNER | STATUS |
|---|---|---|---|---|---|---|---|---|
| R-155 | A1 admin RBAC bypass | CRITICAL | SECURITY | Unauthenticated → SUPER_ADMIN fabrication; requireRoles now jwtVerify()s | production-audit.md:24,81 | regression: unauth /admin/telemetry → 401 | EMERGENCY-VERIFIED | FIXED |
| R-156 | A2 register priv-esc | CRITICAL | SECURITY | Register allowed role:ADMIN → enum BUYER/SELLER | production-audit.md:25,82 | regression: role=ADMIN register rejected | EMERGENCY-VERIFIED | FIXED |
| R-157 | A3 OTP bypass | CRITICAL | SECURITY | Universal code 123456 → random, test-only mock, Twilio prod | production-audit.md:26,83 | regression: 123456 rejected; 5-try lockout | EMERGENCY-VERIFIED | FIXED |
| R-158 | A4 SQLi/mass-assign | CRITICAL | SECURITY | Dynamic SET built from body → whitelist map | production-audit.md:27,84 | regression: only whitelisted cols updated | EMERGENCY-VERIFIED | FIXED |
| R-159 | A5 no-expiry JWT | CRITICAL | SECURITY | No exp / re-sign → 15m access + hashed rotated refresh | production-audit.md:28,85 | decode token has exp; refresh valid | EMERGENCY-VERIFIED | FIXED |
| R-160 | A6 Stripe webhook forgery | CRITICAL | SECURITY | Unauth webhook → raw-body signature verify | production-audit.md:29,86 | forged payload → 400 | EMERGENCY-VERIFIED | FIXED |
| R-161 | A7 M-Pesa callback | CRITICAL | SECURITY | Forgeable callback → amount reconciliation + PENDING guard | production-audit.md:30,87 | forged/mismatched → rejected | EMERGENCY-VERIFIED | FIXED |
| R-162 | A8 money printer | CRITICAL | SECURITY | /billing/topup free credit → removed (409) | production-audit.md:31,88 | POST topup → 409 | EMERGENCY-VERIFIED | FIXED |
| R-163 | A9 wallet drain | CRITICAL | SECURITY | Unauth wallet/deduct → auth + token-derived user | production-audit.md:32,89 | unauth deduct → 401 | EMERGENCY-VERIFIED | FIXED |
| R-164 | A10 hardcoded M-Pesa creds | CRITICAL | SECURITY | Committed sandbox creds → env-only | production-audit.md:33,90 | grep literals → absent | EMERGENCY-VERIFIED | FIXED |
| R-165 | A11 profile backdoor | HIGH | SECURITY | POST /v1/users unauth → removed | production-audit.md:34,91 | unauth POST → 404 | EMERGENCY-VERIFIED | FIXED |
| R-166 | A12 mass assignment | HIGH | SECURITY | PUT /users/me role fields → strict whitelist | production-audit.md:35,92 | role fields ignored | EMERGENCY-VERIFIED | FIXED |
| R-167 | A13 replay state machine | HIGH | SECURITY | Unconditional status flips → PENDING-guards + event-on-transition | production-audit.md:36,93 | replay webhook → no dup events | EMERGENCY-VERIFIED | FIXED |
| R-168 | A14 payment IDOR | HIGH | SECURITY | Any payment readable → findOwnedById | production-audit.md:37,94 | user B reads A → 404 | EMERGENCY-VERIFIED | FIXED |
| R-169 | A15 validation | HIGH | SECURITY | Amount/currency gaps; CRYPTO orphan → enums + bounds | production-audit.md:38,95 | extreme amounts rejected | EMERGENCY-VERIFIED | FIXED |
| R-170 | A16 client price | HIGH | SECURITY | Client-set price/sellerId → server-resolved price | production-audit.md:39,96 | tampered price rejected | EMERGENCY-VERIFIED | FIXED |
| R-171 | A17 billing atomicity | HIGH | OPERATIONS | Deduct+credit+earnings non-transactional → one tx + delta billing | production-audit.md:40,97 | concurrent usage no double-bill | EMERGENCY-VERIFIED | FIXED |
| R-172 | A18 unauth sessions | HIGH | SECURITY | /sessions unauth arbitrary buyer → auth + token-derived buyer | production-audit.md:41,98 | unauth → 401 | EMERGENCY-VERIFIED | FIXED |
| R-173 | A19 marketplace scan | HIGH | SECURITY | Full-dataset seller scan → hgetall + capped (100) | production-audit.md:42,99 | direct lookup only | EMERGENCY-VERIFIED | FIXED |
| R-174 | A20 admin page.js | HIGH | DEPLOYMENT | Duplicate compiled artifact broke build → deleted | production-audit.md:43,100 | next build OK | EMERGENCY-VERIFIED | FIXED |
| R-175 | A21 auth pages 404 | HIGH | DEPLOYMENT | dynamicParams=false w/o staticParams → removed | production-audit.md:44,101 | /auth/* resolves | EMERGENCY-VERIFIED | FIXED |
| R-176 | A22 localhost bypass | HIGH | SECURITY | Hardcoded 127.0.0.1:3008 API → env-based client | production-audit.md:45,102 | no localhost in prod build | EMERGENCY-VERIFIED | FIXED |
| R-177 | A23 middleware matcher | HIGH | SECURITY | Matcher never matched → fixed; server-side session check | production-audit.md:46,103 | / protected | EMERGENCY-VERIFIED | FIXED |
| R-178 | A24 no OTA | HIGH | MOBILE | No expo-updates → configured updates.url + fingerprint | production-audit.md:47,104 | EAS update works | EMERGENCY-VERIFIED | FIXED |
| R-179 | A25 fee source-of-truth | MEDIUM | OPERATIONS | Fee 0.10 vs 20% spec → PLATFORM_FEE_PCT=0.20 at completion | production-audit.md:48,105 | money tests | EMERGENCY-VERIFIED | FIXED |
| R-180 | A26 DB SSL opt-in | MEDIUM | SECURITY | ssl rejectUnauthorized:false → documented opt-in; still needs CA (A-05) | production-audit.md:49,106 | DATABASE_SSL_CA | EMERGENCY-VERIFIED | RESOLVED |
| R-181 | A27 cleartext off | MEDIUM | MOBILE | usesCleartextTraffic:true global → false for production | production-audit.md:50,107 | manifest prod cleartext off | EMERGENCY-VERIFIED | FIXED |
| R-182 | A28 mobile hygiene | MEDIUM | MOBILE | wireguard-mock stubs, placeholder google-services.json, missing play-store-key.json → deferred to store release | production-audit.md:51,108 ; mobile-privacy M-10 | remove stubs; real firebase+keystore | team | PARTIAL |
| R-183 | A29 internal API | MEDIUM | SECURITY | /v1/internal/* unauth → authorize(['ADMIN','SUPER_ADMIN']) | production-audit.md:52,109 | unauth → 401 | EMERGENCY-VERIFIED | FIXED |
| R-184 | A30 repo hygiene | MEDIUM | SUPPLY-CHAIN | Duplicate services/* trees, koyeb.zip, scratch/fetch-*.js, logcat, compiled .js retained (deprecated) | production-audit.md:53,110 ; mobile M-20b | decommission legacy trees | team | PARTIAL |
| R-185 | A31 lockfiles | LOW | SUPPLY-CHAIN | Backend lockfile committed; root lockfile pending → still untracked per Sept-24 audit | production-audit.md:54,111 ; software-supply-chain.md:16-18 | commit root lockfile | team | PARTIAL |
| R-186 | A32 privacy page | LOW | COMPLIANCE | buyer-web had no /privacy → added | production-audit.md:55,112 | route builds | EMERGENCY-VERIFIED | FIXED |
| R-187 | A33 dead code | LOW | SECURITY | authorize()/risk-scoring dead branches → removed/resolved | production-audit.md:56,113 | grep clean | EMERGENCY-VERIFIED | RESOLVED |
| R-188 | A34 credit path | LOW | OPERATIONS | dm.payment.completed consumer → in-tx wallet credit + ledger | production-audit.md:57,114 | E2E purchase credits wallet | EMERGENCY-VERIFIED | FIXED |
| R-189 | A35 babel/next | LOW | DEPLOYMENT | .babelrc broke Neon auth-ui ESM barrel → removed; SWC import fix | production-audit.md:58,115 | next build OK | EMERGENCY-VERIFIED | FIXED |
| R-190 | A36 wallet routes | LOW | MOBILE | /wallet/* 404 → /billing/* | production-audit.md:59,116 | routes match backend | EMERGENCY-VERIFIED | FIXED |
| R-191 | A37 withdraw body | LOW | MOBILE | {amount} → {amount_usd, method, phone_number} | production-audit.md:60,117 | body matches contract | EMERGENCY-VERIFIED | FIXED |
| R-192 | A38 fake relay config | HIGH | MOBILE | Legacy /sessions fabricated config → server-resolved sessions/start+end, real hardwareId | production-audit.md:61,118 | connect uses real price | EMERGENCY-VERIFIED | FIXED |
| R-193 | A39 admin prefixes | LOW | DEPLOYMENT | /admin/* vs /v1/admin/* 404 → dual-mounted | production-audit.md:62,119 | both prefixes work | EMERGENCY-VERIFIED | FIXED |
| R-194 | A40 fabricated listings | HIGH | MOBILE | $0.5/GB, 50Mbps, 99% stability fallbacks → real-only values | production-audit.md:63,120 | real values/null honest | EMERGENCY-VERIFIED | FIXED |
| R-195 | A41 vpn_config placeholder | HIGH | MOBILE | relay:51820/[generated] → built from registered relay, fail-closed | production-audit.md:64,121 | 409 SELLER_RELAY_NOT_REGISTERED | EMERGENCY-VERIFIED | FIXED |
| R-196 | A42 telemetry fabrication | MEDIUM | MOBILE | activeSessions*0.25 → SUM(bytes_used)/1024^3 | production-audit.md:65,122 | real sums | EMERGENCY-VERIFIED | FIXED |
| R-197 | A43 stats dead call | MEDIUM | MOBILE | /users/me/stats none → real route; ratings honestly null | production-audit.md:66,123 | route exists | EMERGENCY-VERIFIED | FIXED |
| R-198 | A44 profile badges | MEDIUM | MOBILE | Hardcoded ELITE/VERIFIED/PREMIUM → real is_seller/kyc_level | production-audit.md:67,124 | honest badges | EMERGENCY-VERIFIED | FIXED |
| R-199 | A45 relay screen claims | MEDIUM | MOBILE | Active tunnels/99%/94.2Mbps fabrications → honest ping/speed/registration | production-audit.md:68,125 | measured only | EMERGENCY-VERIFIED | FIXED |
| R-200 | A46 buyer-web hardwareId + NaN | LOW | MOBILE | seller-id-as-hardwareId; unguarded avg_speed/stability → real device id + null-safe | production-audit.md:69,126 | null-safe renders | EMERGENCY-VERIFIED | FIXED |

---

## Summary counts (register)

| Source | Rows | Status mix |
|---|---|---|
| auth-session-crypto-audit | R-001…R-028 | 4 ACCEPTED RISK, rest OPEN, 2 HIGH prod-blocking |
| software-supply-chain | R-029…R-043 | 5 CRITICAL, 4 HIGH, 2 MODERATE open |
| mobile-privacy | R-044…R-064 | 1 CRITICAL (R-054 signing), 4 HIGH, rest MEDIUM/LOW |
| environment / asset / lineage | R-065…R-079 | 4 FAILED, 2 LEGAL REVIEW REQUIRED |
| data-lifecycle | R-080…R-096 | 1 CRITICAL (D-09), 4 HIGH |
| policy-integrity | R-097…R-112 | 10 MISMATCH / 2 BLOCKED |
| compliance | R-113…R-132 | 6 LRR, 1 BLOCKED, 3 FAIL |
| operations / IRP / testing | R-133…R-151 | 2 FAILED-blockers (backups, monitoring), 6 BLOCKED |
| threat-model / api-audit | R-152…R-154 | 2 ACCEPTED RISK |
| production-audit history | R-155…R-200 | 43 FIXED/RESOLVED, 3 PARTIAL |

**Top production-blocking rows:** R-133 (no backups), R-134 (no monitoring/alerting),
R-005 (DB TLS), R-010 (legacy refresh), R-012 (Kafka-only admin enforcement),
R-029 (untracked lockfiles / broken CI), R-030/R-031 (critical JWT/auth chains),
R-054 (debug-key signing), R-055 (no account deletion), R-088 (DSAR PII copies).