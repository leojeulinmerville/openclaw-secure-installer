# Secure Installer MVP Verification

This guide validates the Secure Installer MVP (Windows host, Docker runtime) with Safe Mode implementation.

## 1. Prerequisites
- Switch to `mvp` branch: `git checkout mvp`
- Ensure no existing containers: `docker compose -f docker-compose.mvp.yml down`

## 2. Docker Build & Setup
Build the images and run the setup wizard.
```powershell
docker compose -f docker-compose.mvp.yml --env-file .env.mvp up -d --build
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm openclaw-cli setup
```
**Verification:**
- Gateway logs should show "listening on ws://127.0.0.1:18789"
- `docker compose -f docker-compose.mvp.yml --env-file .env.mvp logs -n 50 openclaw-gateway`

## 3. Runtime Hardening Verification
Verify the container is confined as expected.
```powershell
# Get Gateway Container ID
$cid = docker ps -q --filter "name=openclaw-gateway"

# 3.1 Read-only Rootfs (Should FAIL with "Read-only file system")
docker exec -it $cid sh -lc "touch /app/should_fail && echo FAIL || echo OK"

# 3.2 Persistent Home (Should SUCCEED)
docker exec -it $cid sh -lc "touch /home/node/persist_test && echo OK || echo FAIL"

# 3.3 Security Options (Should show ReadonlyRootfs=true, CapDrop=["ALL"], no-new-privileges=true)
docker inspect $cid --format "{{json .HostConfig.ReadonlyRootfs}} {{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}}"
```

## 4. Safe Mode Verification
Verify that `OPENCLAW_SAFE_MODE=1` enforces restrictions.
```powershell
# Try to execute a disallowed command (e.g. ls) via openclaw-cli
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm openclaw-cli agent run -- "ls -la"
# Expect output containing: "Safe Mode validation failed"
```

## 5. Automated Tests
Run specific tests to validate fixes in the secure environment.
*Note: We force vitest cache to a writable directory for read-only containers.*

```powershell
# Browser CLI Extension (Fixture-based)
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm --entrypoint sh openclaw-cli -lc "VITE_CACHE_DIR=/tmp/.vite-temp pnpm vitest src/cli/browser-cli-extension.test.ts"

# Cron Protocol Conformance (Skips if no macOS)
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm --entrypoint sh openclaw-cli -lc "VITE_CACHE_DIR=/tmp/.vite-temp pnpm vitest src/cron/cron-protocol-conformance.test.ts"

# Bash Tools NotifyOnExit (Portable Node command)
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm --entrypoint sh openclaw-cli -lc "VITE_CACHE_DIR=/tmp/.vite-temp pnpm vitest src/agents/bash-tools.test.ts -t notifyOnExit"
```
