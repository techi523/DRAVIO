# Unblock DRAVIO with WSL2 + Docker + Postgres + Redis

Status: user chose "Install WSL2 + Docker" on 2026-09-22.
WSL2 install launched elevated (`wsl.exe --install --no-distribution`, log:
`%TEMP%\opencode\wsl-install.log`). A **reboot is expected** to activate the
VirtualMachinePlatform feature. Resume after reboot with the steps below.

## What was already achieved (2026-09-22)
- Real backend running on host `0.0.0.0:8080` (needs only `JWT_SECRET`):
  `cd backend; tsx src/index.ts` with `JWT_SECRET=<48-char> NODE_ENV=development`.
  DB/Redis/Kafka degrade soft — server stays up.
- App→server connectivity FIXED (`adb reverse tcp:8080 tcp:8080`; the dev
  build's API base is `http://localhost:8080/v1` on the device loopback).
  App now shows the server's real `INTERNAL_SERVER_ERROR` instead of
  `Cannot reach the server.`.
- Proof/detail: `docs/testing/MOBILE_RESULTS.md` ("Live-backend connectivity
  session") and `docs/testing/TEST_RESULTS.md`.

## Post-reboot resume steps

1. Verify WSL2 is active: `wsl --status` (should report a distro-less WSL2 or
   the docker-desktop distro) and `wsl --version` (kernel 2.x). If feature
   enablement still needs a restart, reboot again.
2. Start Docker Desktop (`C:\Users\Admin\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`),
   wait until `docker version --format "{{.Server.Version}}"` returns.
3. Postgres + Redis:
   ```
   docker run -d --name dravio-db -e POSTGRES_USER=dravio_user -e POSTGRES_PASSWORD=dravio_password -e POSTGRES_DB=dravio_production -p 5432:5432 postgres:16
   docker run -d --name dravio-redis -p 6379:6379 redis:7
   ```
4. Load schema (repo root): `master_init.sql` then `backend/migrations/001_hardening.sql`:
   ```
   docker exec -i dravio-db psql -U dravio_user -d dravio_production < master_init.sql
   docker exec -i dravio-db psql -U dravio_user -d dravio_production < backend/migrations/001_hardening.sql
   ```
5. Start the backend WITH the DB (this is the full production path):
   ```
   cd backend
   $env:JWT_SECRET='<48 chars>'; $env:DATABASE_URL='postgres://dravio_user:dravio_password@localhost:5432/dravio_production'; $env:REDIS_URL='redis://localhost:6379'; $env:NODE_ENV='development'
   tsx src/index.ts
   ```
   Sanity: `curl http://127.0.0.1:8080/v1/health` -> 200 (route exists per
   earlier probe session; `/health` also returns 200).
6. Re-boot the emulator + Metro + app (a reboot kills them):
   - `C:\Users\Admin\AppData\Local\Android\Sdk\emulator\emulator.exe -avd dravio-test -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect -no-metrics`
   - `adb reverse tcp:8081 tcp:8081; adb reverse tcp:8080 tcp:8080`
   - from `apps/mobile-app`: `npx expo start --port 8081` then launch
     `com.dravio.app/.MainActivity` (`am start -n com.dravio.app/.MainActivity`).
7. Register a REAL user via the app (or `curl -X POST
   http://127.0.0.1:8080/v1/auth/register` with valid schema fields), then log
   in. Expect a successful token response — this unblocks T11 and the Web E2E
   suite. Update `docs/testing/*` and un-BLOCK the DB/API rows in
   `docs/testing/TEST_RESULTS.md`, `FINAL_TEST_REPORT.md`.

## Notes
- WSL had never been installed; no native PostgreSQL (checked 5432). Docker
  Desktop was present but unable to run Linux containers without WSL2.
- Redis is optional (caching/degraded warnings only).

## Screenshot: what actually happened (2026-09-22 09:0x, before reboot)
- `wsl --install --no-distribution` succeeded: **WSL 2.7.14 / kernel 6.18.33.2-2**
  installed, `exitcode=0`, feature ops "completed successfully", **no reboot
  required to use WSL itself** (`wsl --status`, `wsl --version`, and an
  interactive `wsl -d docker-desktop sh -c "echo WSL-VM-OK"` all worked).
- Docker Desktop 29.6.2 (installed but never runnable without WSL) then FAILED
  to start its engine repeatedly:
  - `com.docker.backend.exe` launches then `exit status 1`.
  - `docker-desktop` WSL distro stays `Stopped`; `wsl --terminate docker-desktop`
    itself failed with `exit status 0xc0000142` (DLL init failure) shortly after
    install — a classic "needs reboot to stabilize VM Platform" symptom.
  - Logs (`%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`) show the
    guest `socketforwarder-receive-fds.sock` / `vpnkit-bridge` taking **2m24s+**
    to appear — engine startup outlives Docker Desktop's waits on this
    resource-starved host (8 GB RAM, many user apps running: Chrome/Brave,
    WhatsApp, IDM, MoreLogin, emulator, Metro, backend).
  - `com.docker.build` crashes with `exit status 1` repeatedly.
- `wsl --shutdown` + relaunch cycles did NOT fix it same-session.

### → Decision: REBOOT the machine, then resume (steps 1-7 above).
Everything needed after reboot is already documented in the top of this file.
Post-reboot environment expectations:
- WSL VM platform fully initializes; Docker Desktop engine should start within
  its normal window (no more 2m24s socket waits / 0xc0000142).
- After reboot the running Android emulator, Metro (:8081), and the DRAVIO
  backend (:8080) are gone — restart them per steps 6 in the resume section
  (emulator flags, `adb reverse` for 8081 AND 8080, `npx expo start --port
  8081`, backend as step 5).
- Verify engine with `docker version --format "{{.Server.Version}}"` (or just
  `docker ps`). If Docker Desktop GUI asks for a product license/onboarding on
  first start, accept it (this is the normal one-time flow).