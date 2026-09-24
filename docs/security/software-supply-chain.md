# Software Supply-Chain Security Audit — DRAVIO monorepo

- Date: 2026-09-24
- Scope: `C:\Users\Admin\Desktop\DRAVIO` (Node/TS monorepo, npm workspaces)
- Auditor mode: read-only — no package.json, lockfile, or code files were modified
- Statuses used: VERIFIED / PARTIAL / FAILED / BLOCKED / NOT VERIFIED / NOT APPLICABLE

---

## 1. Audit method + commands run

| Command | Where | Result | Status |
|---|---|---|---|
| `npm audit --json` (timeout 120s) | repo root (workspaces) | Timed out at 120s (workspace tree is large) | FAILED → retried |
| `npm audit --json` (timeout 300s) | repo root (workspaces) | Returned full JSON: 1,815 total deps (prod 1,242 / dev 444 / opt 172 / peer 23); vulns **43 = 33 moderate, 5 high, 5 critical** | VERIFIED |
| `npm audit --json` | `backend/` | Returned full JSON: 363 deps; vulns **12 = 9 moderate, 2 high, 1 critical** | VERIFIED |
| `git check-ignore -v package-lock.json backend/package-lock.json` | repo | Both matched `.gitignore:4` (`package-lock.json`) — **untracked, not in any commit** | VERIFIED |
| `git ls-files` grep `package-lock|\.npmrc` | repo | No committed lockfile, no `.npmrc` anywhere (repo-wide recursive `Get-ChildItem` also found zero `.npmrc`) | VERIFIED |
| Read `node_modules/**/package.json` `postinstall/preinstall/install` (depth ≤3) | root + backend `node_modules` | 6 top-level hits at root, 2 at backend (see §5) | VERIFIED |
| `npm ls --depth=0` | repo root | **FAILED — ELSPROBLEMS**: 10 UNMET workspace links, UNMET `@fastify/compress`, `@neondatabase/serverless`, `@tsconfig/node18`, ~19 extraneous pkgs | FAILED |
| `npm ls --depth=0` | `backend/` | Clean tree, all 27 deps present, no extraneous/missing | VERIFIED |
| Lockfile v3 + integrity hash count via `node` | root + backend | Root: 1,816 entries, 1,787 carry `sha512` integrity (only 29 internal workspace/link entries lack it — by design). Backend: 364 entries, 363 with integrity | VERIFIED |
| `npm view @dravio/backend` | registry | `404 Not Found` — **`@dravio/*` scope is NOT published on the public registry** | VERIFIED |
| `npm config get registry` | env | `https://registry.npmjs.org/` (default public) | VERIFIED |

Notes on evidence fidelity:
- `npm audit` analyzes the on-disk `package-lock.json` dependency graph (single source of truth for what `npm ci` would build), NOT the stale root `node_modules` tree. The installed root tree and the lockfile have drifted (see §4).
- `npm ci` was **not executed** (it wipes `node_modules`; would mutate the environment). Its failure without a committed lockfile is documented npm behaviour (aborts with `ENOENT package-lock.json`) and therefore marked PARTIAL (reasoned, not executed).

---

## 2. Dependency inventory (direct dependencies)

Pinned version = exact version recorded in the *lockfile* (what `npm ci` would install).

### Root `package.json` (workspace root, `private: true`)
| PACKAGE | VERSION (lockfile) | PURPOSE | RISK | ACTION | STATUS |
|---|---|---|---|---|---|
| `@fastify/compress` | 7.0.3 (exact pin) | gzip/br response compression | GREEN | none | VERIFIED |
| `@neondatabase/serverless` | 1.1.0 (`^1.1.0`) | Neon Postgres serverless driver | GREEN | none | VERIFIED |
| `caniuse-lite` | 1.0.30001810 (`^`) | browserslist data | GREEN | none | VERIFIED |
| `react-native-web` | 0.21.2 (`^0.21.2`) | React Native web renderer | GREEN | none | VERIFIED |

### `backend/package.json` (`@dravio/backend`, `private: true`, ESM)
| PACKAGE | VERSION (lockfile) | PURPOSE | RISK | ACTION | STATUS |
|---|---|---|---|---|---|
| `fastify` | 4.29.1 (`^4.26.2`) | HTTP framework | **YELLOW→RED**: HIGH (content-type tab body-validation bypass) + DoS + `find-my-way` DDoS | major to 5.12.5 (coordinate w/ plugins); audit fix says 5.12.5 | VERIFIED |
| `@fastify/jwt` | 8.0.1 (`^8.0.0`) | JWT auth plugin | **RED**: pulls `fast-jwt@4.0.5` CRITICAL (alg-confusion, cache-confusion, empty-HMAC auth bypass) | upgrade to 10.2.2 (needs fastify 5) or `overrides fast-jwt ≥6.2.4` interim | VERIFIED |
| `fastify-plugin` | 4.5.1 | plugin module helper | GREEN | none | VERIFIED |
| `firebase-admin` | 12.7.0 (`^12.0.0`) | Firebase admin SDK | YELLOW: MODERATE via `uuid`, `gaxios`, `google-gax`, `@google-cloud/storage+firestore` | major to 14.5.0 | VERIFIED |
| `uuid` | 7.0.3 (`^7.0.3`) | UUID generation | YELLOW: MODERATE (v3/v5/v6 buffer OOB; N/A if only v4 used) | ≥11.1.1 (drop-in for v4) | VERIFIED |
| `axios` | 1.20.0 | HTTP client | GREEN | none | VERIFIED |
| `bcryptjs` | 3.0.3 | pure-JS password hashing | GREEN | none | VERIFIED |
| `cloudinary` | 2.11.0 | media upload | GREEN | none | VERIFIED |
| `dotenv` | 16.6.1 | env loading | GREEN | none | VERIFIED |
| `fastify-socket.io` | 4.0.0 | socket.io adapter | GREEN | none | VERIFIED |
| `ioredis` | 5.11.1 | Redis client | GREEN | none (note: duplicate of `redis`) | VERIFIED |
| `jsonwebtoken` | 9.0.3 | legacy JWT impl | GREEN (dup of `@fastify/jwt`) | consolidate | VERIFIED |
| `kafkajs` | 2.2.4 | Kafka producer/consumer | GREEN | none | VERIFIED |
| `pg` | 8.23.0 | Postgres driver | GREEN | none | VERIFIED |
| `redis` | 5.12.1 | Redis client | GREEN | none (duplicate of `ioredis`) | VERIFIED |
| `socket.io` / `socket.io-client` | 4.8.3 / 4.8.3 | websockets srv/client | GREEN | none | VERIFIED |
| `stripe` | 14.25.0 | Stripe payments | GREEN | none | VERIFIED |
| `twilio` | 6.1.1 | SMS/Voice | GREEN | none | VERIFIED |
| `zod` | 3.25.76 | schema validation | GREEN | none | VERIFIED |
| `@fastify/cors` `helmet` `multipart` `rate-limit` `websocket` | 9.0.1 / 11.1.1 / 8.3.1 / 9.1.0 / 9.0.0 | CORS, headers, uploads, RLL, WS | GREEN | none (will co-bump with fastify 5) | VERIFIED |

### Workspaces — key direct deps (services/apps/packages)
| PACKAGE | VERSION (lockfile) | OWNER(S) | PURPOSE | RISK | ACTION | STATUS |
|---|---|---|---|---|---|---|
| `@fastify/http-proxy` | 9.5.0 | `gateway-service` | reverse proxy plugin | **RED — CRITICAL** GHSA-gwhp-pf74-vj37 (connection-header abuse strips proxy-added headers, CVSS 8.6) | major to 11.6.2 | VERIFIED |
| `@fastify/reply-from` | 9.8.0 | (via http-proxy) | reply forwarding | **RED — CRITICAL** (forwarding bypass + header strip + undici) | via http-proxy bump | VERIFIED |
| `@fastify/jwt` | 8.0.1 | backend + 7 services | JWT auth | **RED** (fast-jwt chain) | see backend | VERIFIED |
| `fastify` | 4.29.1 | backend + all services | HTTP framework | HIGH | see backend | VERIFIED |
| `bcrypt` | 5.1.1 | `auth-service` (native) | native password hashing | **RED — CRITICAL `tar@6.2.1`** via `@mapbox/node-pre-gyp` (10+ tar advisories: traversal, decompression DoS, stack-overflow DoS) | replace with `bcryptjs` (already a dependency) or argon2; drop node-gyp path | VERIFIED |
| `@neondatabase/auth` | 0.4.2-beta | `admin-portal`, `buyer-web` | Neon auth (better-auth-based) | **RED — CRITICAL `better-auth@1.4.18`** (10 adv: refresh-token replay CVSS 9.1, account-takeover x2, stale sessions) | pin `better-auth ≥1.6.22` via overrides or upgrade `@neondatabase/auth` ≥0.5.0-beta | VERIFIED |
| `next` | 15.5.25 | `admin-portal`, `buyer-web` | React framework | YELLOW: MODERATE + **HIGH `postcss@8.5.28`** (arbitrary file read via sourceMappingURL) | major to 16.3.6 | VERIFIED |
| `firebase` | 10.14.1 | web apps + mobile | client auth/firestore/storage | YELLOW: MODERATE via `undici` | major to ~12.x | VERIFIED |
| `expo` | 55.0.31 | `mobile-app` | RN framework | YELLOW: noisy canary-range advisories; **fixAvailable = expo@46.0.21 = DOWNGRADE — do not apply blindly** | SDK bump via `npx expo install --fix`, ignore audit "fix" | VERIFIED |
| `@expo/ngrok` | 4.1.3 | mobile (dev tunnel) | tunnel | YELLOW: MODERATE uuid, `fixAvailable: false` | dev-only; monitor | VERIFIED |
| `@react-native-google-signin/google-signin` | 16.1.5 | mobile | Google sign-in | YELLOW: via expo | part of expo SDK bump | VERIFIED |
| `react-native-wireguard-vpn` | 1.0.22 | mobile | VPN in-app | YELLOW: via expo; audit "fix" = downgrade to 1.0.20 | review whether VPN is needed; small maintainer base | VERIFIED |
| `uuid` | 7.0.3 | `billing-service` | UUID | YELLOW: MODERATE buffer OOB | ≥11.1.1 | VERIFIED |
| `postcss` | 8.5.28 (transitive) | via `next` | CSS | **HIGH** | next bump / overrides | VERIFIED |

Unpinning check: root pins only `@fastify/compress` exactly; everything else uses `^`/`~` caret ranges (backend **all** deps caret). With a committed lockfile, caret ranges are acceptable; without one (§4) every install is a fresh resolution → supply-chain drift.

---

## 3. Transitive / known-vulnerability highlights (top 15 by severity)

Union of both `npm audit` runs (root worked-poisoned: lockfile shares many packages).

| # | Package (pinned) | Severity | Key advisories | Reach |
|---|---|---|---|---|
| 1 | `fast-jwt@4.0.5` | **CRITICAL** | empty-HMAC async-key auth bypass, whitespace alg confusion, cache-key collisions (token-claim mixup), crit-header acceptance — 3×CVSS 9.1 | backend + all 7 services via `@fastify/jwt@8.0.1` |
| 2 | `better-auth@1.4.18` | **CRITICAL** | OAuth refresh-token replay w/o client auth (CVSS 9.1), account takeover via auto-link/pre-account, stale sessions | admin-portal + buyer-web via `@neondatabase/auth@0.4.2-beta` |
| 3 | `tar@6.2.1` | **CRITICAL** | infinite-loop DoS, decompression DoS (CVSS 7.5), hardlink/symlink path traversal, recursive stack-overflow DoS (11 advisories) | auth-service `bcrypt@5.1.1` → `@mapbox/node-pre-gyp@1.0.11` |
| 4 | `@fastify/http-proxy@9.5.0` | **CRITICAL** | connection-header abuse strips proxy-added auth headers (CVSS 8.6) | gateway-service (direct) |
| 5 | `@fastify/reply-from@9.8.0` | **CRITICAL** | reply forwarding bypass + header strip | via http-proxy |
| 6 | `undici@5.29.0` | **HIGH** | request smuggling, WS length-overflow crash, unbounded decompression/WS memory, CRLF/header injection (16 adv) | via `@firebase/*`, `@fastify/reply-from`, `teeny-request` |
| 7 | `postcss@8.5.28` | **HIGH** | arbitrary `.map` file read via `sourceMappingURL` (path traversal, GHSA-r28c-…/6g55-…) | via `next@15.5.25` |
| 8 | `fastify@4.29.1` | **HIGH** | content-type tab char body-validation bypass | backend + all services direct |
| 9 | `find-my-way@8.2.2` | **HIGH** | HTTP/2 DDoS (CVSS 7.5) | via fastify |
| 10 | `@mapbox/node-pre-gyp@1.0.11` | **HIGH** | (chain via `tar`) | auth-service native build |
| 11 | `firebase-admin@12.7.0` | MODERATE | uuid/gaxios/google-gax/storage/firestore/retry-request/teeny-request chains | backend direct |
| 12 | `next@15.5.25` | MODERATE | via postcss | web apps |
| 13 | `firebase@10.14.1` | MODERATE | via undici (auth/firestore/functions/storage) | web + mobile |
| 14 | `uuid@7.0.3` (+nested) | MODERATE | v3/v5/v6 buffer bounds OOB (GHSA-w5hq-g745-h8pq) | firebase-admin, gaxios, google-gax, teeny-request, xcode, @expo/ngrok, billing-service |
| 15 | `expo@55.0.31` + `@expo/*` | MODERATE (noise) | canary-version-range advisories; "fix" = **downgrade to 46.0.21**; `@expo/ngrok` has no fix | mobile-app |

`npm audit` metdata: **root = 43 (33M/5H/5C)**; **backend = 12 (9M/2H/1C)**. Audit rows above are from actual tool output; no counts were invented.

---

## 4. Lockfile & reproducibility findings

- **RED — both `package-lock.json` files are untracked.** `.gitignore:4` matches them (verified `git check-ignore -v` and `git ls-files`). `git status` shows clean worktree → the fix isn't pending, the files are simply never committed.
- **`npm ci` is broken in CI.** `deploy.yml` runs `npm ci` (jobs `lint-and-typecheck`, `test`) with no `working-directory` → plays at repo root, where no lockfile exists after checkout. `npm ci` aborts with a missing-lockfile error. (Not executed locally to avoid wiping `node_modules`; behaviour is documented npm semantics.) → **PARTIAL/FAILED**
- **No `.npmrc`** anywhere in the repo (recursive search, zero hits). Registry = default `https://registry.npmjs.org/`. No `save-exact`/audit/custom-registry settings; no `overrides` section to control transitive resolution.
- Both lockfiles are **v3 with `sha512` integrity hashes** (root 1,787/1,816 entries; backend 363/364). The 29 non-integrity root entries are all internal workspace/file: links — expected. So integrity verification is available **once committed**.
- **Root `node_modules` is out of sync with the lockfile** (`npm ls --depth=0` → ELSPROBLEMS: 10 UNMET `@dravio/*` workspace links, UNMET `@fastify/compress`/`@neondatabase/serverless`/`@tsconfig/node18`, ~19 extraneous e.g. `pg`, `tsx`, `esbuild`, `split2`). `backend/node_modules` is clean and in sync. Local drift only; `npm ci` would rebuild it from the lockfile(s).
- `engines`: root & backend `node >=20`; CI pins Node 20 → consistent. If lockfiles are committed, `cache: 'npm'` keying in CI also becomes stable.
- Implications ranked: (1) no reproducible deployments, (2) dependency resolution is "last-known-good" only on the current dev machine, (3) npm audit / Dependabot can't operate against CI, (4) vulnerability remediation can't be version-locked before upgrade.

---

## 5. Postinstall / privilege notes

Scan: `Get-ChildItem node_modules -Depth 3 -Filter package.json | Select-String "postinstall|preinstall|install"` on root + backend.

| Package | Hook | Assessment |
|---|---|---|
| `core-js@3.50.0` | postinstall | benign (upstream info banner) |
| `esbuild@0.28.2` | postinstall `node install.js` | legit platform-binary resolution; binary downloads are integrity-checked via lockfile — **only if lockfile is committed** |
| `protobufjs@7.6.6` | postinstall | benign (scripts/postinstall) |
| `unrs-resolver@1.12.2` | postinstall `node postinstall.js` | napi binary resolver (Oxc ecosystem); legit, newer package |
| `sharp@0.35.4` | *(grep match only)* | **verified NO lifecycle install script** (scripts object inspected; match was keyword noise) |
| `sorted-btree@1.8.1` | *(grep match only)* | **FALSE POSITIVE** — the `"install"` match is `testpack.install` config, not a lifecycle hook |
| backend `esbuild`, `protobufjs` | as above | covered |
| `bcrypt@5.1.1` | node-gyp native build via `@mapbox/node-pre-gyp` | **flagged**: install-time native compile/network fetch; this is *the* `tar` critical chain (§3#3) |
| Workspace package.jsons (root, backend, 8 services, 2 web apps, mobile, 3 packages) | **no** postinstall/prepare/install | clean |

No repo-owned code runs install-time scripts. Privilege note: native/optional-deps run under the build user in CI/Docker; with untracked lockfiles, the exact native binary tarballs are unverifiable at build time.

---

## 6. Typosquatting / dependency-confusion notes

- **No misspelled clones** of well-known packages observed in any direct dependency set (fastify, axios, pg, stripe, twilio, zod, jwt, firebase, expo, next are all mainstream, org-maintained).
- Lower-fame / newer-name direct & transitive packages reviewed — all trace back to identifiable upstreams; no `npm-org-squat` analog found:
  - `fastify-socket.io` (community adapter for the UnJS org stack) — legit.
  - `@neondatabase/auth` + `@neondatabase/auth-ui` — Neon's new auth product; scoped, legit, but 0.x-`beta` tag on a package that reaches two prod web apps and drags in a **critical** better-auth chain.
  - `react-native-wireguard-vpn@1.0.22` — small maintainer base, niche native module; treat as higher-supply-chain-touch surface.
  - `unrs-resolver`, `@nodable/entities` (transitive via `fast-xml-parser` ← `@google-cloud/storage`) — legit upstreams (Oxc / github.com/nodable/val-parsers).
- **Dependency-confusion**: all internal packages are on the `@dravio/*` private scope, `private: true`. Verified `@dravio/backend` returns **404 on the public registry**. Internal references use `file:` specs (e.g. `@dravio/auth-middleware: "file:../../packages/auth-middleware"`) — no bare-version reference that could fall back to a public/private-mirror lookup. No custom registry config exists in the repo. `publishConfig` fields found only in third-party packages (`access: public`) — expected. **Risk: LOW / fail-closed.**

---

## 7. Prioritized remediation list

| # | What | Why | Effort | Risk of change | Priority |
|---|---|---|---|---|---|
| 1 | **Commit both `package-lock.json` files** (remove `.gitignore:4` exclusion), verify `npm ci` in CI | CI `npm ci` currently cannot run; no reproducible/verifiable builds; prevents all further hardening | S | None (pure un-ignore + commit) | P0 |
| 2 | **Kill the `fast-jwt` critical chain**: interim `overrides: { "fast-jwt": ">=6.2.4" }` in root + backend package.json, OR upgrade `@fastify/jwt 8→10.2.2` (requires fastify 5) | JWT auth bypass / token-claim mixup / algorithm confusion in backend and every service | S (overrides) / L (full bump) | Overrides: low (semver-minor within ^8 constraint). Full bump: high-touch API changes across 7 services | P0 |
| 3 | **Pin `better-auth ≥1.6.22`** (admin+buyer) via overrides, or upgrade `@neondatabase/auth` to ≥0.5.0-beta | OAuth refresh-token replay (account takeover), stored XSS surface in two prod web apps | S–M | Beta SDK config/session API churn; needs auth-flow regression tests | P0 |
| 4 | **Remove `bcrypt` from `auth-service`; use `bcryptjs`** (already installed) — Kills `@mapbox/node-pre-gyp`+`tar`+node-gyp entirely | Critical tar traversal/DoS chain reachable at install/build; native dep surface | S–M | Password-format migration/rehash for existing users; bcryptjs API is drop-in | P1 |
| 5 | **Bump `@fastify/http-proxy 9.5.0 → 11.6.2`** (gateway-service) | Critical proxy header-strip + reply-forwarding bypass in the edge gateway | M | Proxy runtime behaviour; needs gateway integration tests | P1 |
| 6 | **`fastify 4.29.1 → 5.12.5`** (backend + all services) — bundle with the `@fastify/*` major bumps (`jwt`, `cors`, `helmet`, `rate-limit`, `websocket`, `multipart`) | High body-validation bypass, DoS, find-my-way DDoS; 4.x is at end of meaningful security fixes | L | Major framework migration; must be coordinated, sequenced with #2 | P1 |
| 7 | **`next 15.5.25 → 16.x`** (admin-portal, buyer-web) | HIGH postcss arbitrary-file-read; next 15 pinned exactly | M–L | App-router/behavioural changes; visual + SSR regression pass | P1 |
| 8 | **`firebase-admin 12→14.5.0`** (backend) and **`firebase 10→12`** (web/mobile) | Clears the uuid/gaxios/google-gax/undici moderate chains at source (rather than 6 partial fixes) | M | Major SDK API changes; token/init code review | P2 |
| 9 | **`uuid ≥11.1.1`** (backend + billing-service) | Moderate v3/v5/v6 buffer OOB; trivially safe if only `v4` used | S | Minimal (drop-in for v4) | P2 |
| 10 | **expo/`@expo/*`/ngrok/wireguard vulnerabilities: DO NOT apply `npm audit fix`** (it proposals **downgrade to expo 46.0.21**). Use `npx expo install --fix`/SDK upgrades; re-review `react-native-wireguard-vpn` necessity | Audit rows are canary-version-range noise; the "fix" version is a downgrade | M | Mobile release cycle; cautious approach | P2 |
| 11 | **Add CI gate after #1**: `npm audit --audit-level=high` + `npm audit signatures`, Dependabot/renovate against the now-committed lockfiles | Prevents new vulnerable transitive arrivals from silently landing | S | Low (may need explicit `allow` list for false-positive canary ranges) | P3 |
| 12 | **Add `.npmrc` (root + backend)** with `save-exact`/audit settings; reduce duplicate surface (`ioredis` vs `redis`, `jsonwebtoken` vs `@fastify/jwt`) | Fewer resolution surprises; fewer maintained libs to monitor | S–M | Consolidation touches code | P3 |

> Honesty note: nothing above was executed; versions/fixes are what `npm audit` reported or what is installed in `backend/` via `npm ls`. Every proposed upgrade is atomic on its own dependency edge and should be gated by the monorepo's existing unit/security/compliance test matrices (`npm run test:fast`, `test:security`, `test:compliance`).