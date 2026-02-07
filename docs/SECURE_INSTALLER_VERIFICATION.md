# Secure Installer Verification

## Start and Stop
Commands:

```text
docker compose -f docker-compose.mvp.yml --env-file .env.mvp down
docker compose -f docker-compose.mvp.yml --env-file .env.mvp up -d --build
```

Observed output (up -d --build, excerpt):

```text
openclaw-cli  Built
openclaw-gateway  Built
Container openclaw-secure-installer-openclaw-gateway-1  Recreated
Container openclaw-secure-installer-openclaw-cli-1  Recreated
Container openclaw-secure-installer-openclaw-gateway-1  Started
```

## Setup
Command:

```text
docker compose -f docker-compose.mvp.yml --env-file .env.mvp run --rm openclaw-cli setup
```

Observed output (excerpt):

```text
Config OK: ~/.openclaw/openclaw.json
Workspace OK: ~/.openclaw/workspace
Sessions OK: ~/.openclaw/agents/main/sessions
Config warnings:
- plugins: plugin: External plugins discovery disabled (only bundled allowed)
```

## Test Runs
Command:

```text
pnpm vitest src/infra/safe-mode.test.ts
```

Observed output (excerpt):

```text
RUN  v4.0.18
? src/infra/safe-mode.test.ts (6 tests)
Test Files 1 passed (1)
Tests 6 passed (6)
```

Command:

```text
pnpm vitest src/cli/browser-cli-extension.test.ts
```

Observed output (excerpt):

```text
RUN  v4.0.18
? src/cli/browser-cli-extension.test.ts (4 tests)
Test Files 1 passed (1)
Tests 4 passed (4)
```

Command:

```text
pnpm vitest src/cron/cron-protocol-conformance.test.ts
```

Observed output (excerpt):

```text
RUN  v4.0.18
? src/cron/cron-protocol-conformance.test.ts (2 tests)
Test Files 1 passed (1)
Tests 2 passed (2)
```

Command:

```text
pnpm vitest src/agents/bash-tools.test.ts -t notifyOnExit
```

Observed output (excerpt):

```text
RUN  v4.0.18
? src/agents/bash-tools.test.ts (17 tests | 16 skipped)
? enqueues a system event when a backgrounded exec exits
Test Files 1 passed (1)
Tests 1 passed | 16 skipped (17)
```

## Confinement Checks
Command:

```text
docker compose -f docker-compose.mvp.yml --env-file .env.mvp exec -T openclaw-gateway touch /app/should_fail
```

Observed output:

```text
touch: cannot touch '/app/should_fail': Read-only file system
```

Command:

```text
docker compose -f docker-compose.mvp.yml --env-file .env.mvp exec -T openclaw-gateway touch /home/node/persist_test
```

Observed output:

```text
(no output, exit code 0)
```

Command:

```text
docker inspect openclaw-secure-installer-openclaw-gateway-1 --format "ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}} CapDrop={{json .HostConfig.CapDrop}} SecurityOpt={{json .HostConfig.SecurityOpt}}"
```

Observed output:

```text
ReadonlyRootfs=true CapDrop=["ALL"] SecurityOpt=["no-new-privileges:true"]
```

## Safe Mode Check
Command:

```text
node --input-type=module --import tsx -e "process.env.OPENCLAW_SAFE_MODE='1'; const { runExec } = await import('./src/process/exec.ts'); try { await runExec('not-allowed', []); } catch (err) { console.error(err instanceof Error ? err.message : String(err)); process.exit(1); }"
```

Observed output:

```text
Safe Mode validation failed: Execution of 'not-allowed' is blocked.
```

## Gateway Logs
Command:

```text
docker compose -f docker-compose.mvp.yml --env-file .env.mvp logs -n 80 openclaw-gateway
```

Observed output (excerpt):

```text
[gateway] listening on ws://127.0.0.1:18789 (PID 15)
[gateway] listening on ws://[::1]:18789
```

Expected:
- listening on ws://127.0.0.1:18789
- no "Missing config" lines
