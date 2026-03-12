---
summary: "Debugging tools: watch mode, raw model streams, and tracing reasoning leakage"
read_when:
  - You need to inspect raw model output for reasoning leakage
  - You want to run the Gateway in watch mode while iterating
  - You need a repeatable debugging workflow
title: "Debugging"
---

# Debugging

This page covers debugging helpers for streaming output, especially when a
provider mixes reasoning into normal text.

## Runtime debug overrides

Use `/debug` in chat to set **runtime-only** config overrides (memory, not disk).
`/debug` is disabled by default; enable with `commands.debug: true`.
This is handy when you need to toggle obscure settings without editing `openclaw.json`.

Examples:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` clears all overrides and returns to the on-disk config.

## Gateway watch mode

For fast iteration, run the gateway under the file watcher:

```bash
pnpm gateway:watch --force
```

This maps to:

```bash
tsx watch src/entry.ts gateway --force
```

Add any gateway CLI flags after `gateway:watch` and they will be passed through
on each restart.

## Dev profile + dev gateway (--dev)

Use the dev profile to isolate state and spin up a safe, disposable setup for
debugging. There are **two** `--dev` flags:

- **Global `--dev` (profile):** isolates state under `~/.openclaw-dev` and
  defaults the gateway port to `19001` (derived ports shift with it).
- **`gateway --dev`: tells the Gateway to auto-create a default config +
  workspace** when missing (and skip BOOTSTRAP.md).

Recommended flow (dev profile + dev bootstrap):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

If you don’t have a global install yet, run the CLI via `pnpm openclaw ...`.

What this does:

1. **Profile isolation** (global `--dev`)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (browser/canvas shift accordingly)

2. **Dev bootstrap** (`gateway --dev`)
   - Writes a minimal config if missing (`gateway.mode=local`, bind loopback).
   - Sets `agent.workspace` to the dev workspace.
   - Sets `agent.skipBootstrap=true` (no BOOTSTRAP.md).
   - Seeds the workspace files if missing:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Default identity: **C3‑PO** (protocol droid).
   - Skips channel providers in dev mode (`OPENCLAW_SKIP_CHANNELS=1`).

Reset flow (fresh start):

```bash
pnpm gateway:dev:reset
```

Note: `--dev` is a **global** profile flag and gets eaten by some runners.
If you need to spell it out, use the env var form:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` wipes config, credentials, sessions, and the dev workspace (using
`trash`, not `rm`), then recreates the default dev setup.

Tip: if a non‑dev gateway is already running (launchd/systemd), stop it first:

```bash
openclaw gateway stop
```

## Raw stream logging (OpenClaw)

OpenClaw can log the **raw assistant stream** before any filtering/formatting.
This is the best way to see whether reasoning is arriving as plain text deltas
(or as separate thinking blocks).

Enable it via CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Optional path override:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Equivalent env vars:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Default file:

`~/.openclaw/logs/raw-stream.jsonl`

## Raw chunk logging (pi-mono)

To capture **raw OpenAI-compat chunks** before they are parsed into blocks,
pi-mono exposes a separate logger:

```bash
PI_RAW_STREAM=1
```

Optional path:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Default file:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Note: this is only emitted by processes using pi-mono’s
> `openai-completions` provider.

## Safety notes

- Raw stream logs can include full prompts, tool output, and user data.
- Keep logs local and delete them after debugging.
- If you share logs, scrub secrets and PII first.

## PostgreSQL Tauri Bootstrap Issues

When developing the desktop app (Tauri), the `postgres.exe` runtime is started dynamically on an available port. 

If the development process is forcefully killed or crashes, the `postgres.exe` process might survive and leave a lock on the `data/pgsql` directory via `postmaster.pid`.

**Symptom:**
During `pnpm tauri dev` or app startup, you see:
```text
[bootstrap] FATAL: wait_for_ready failed: PostgreSQL did not become ready within 15 seconds
```

**What happens:**
The app detects the stale lock but fails to start on the new port because the old instance is still holding the data directory.

**Resolution:**
The bootstrap process in `runtime_pgsql.rs` (`handle_stale_lock`) automatically detects and forcefully kills the orphaned `postgres.exe` if its PID matches the `postmaster.pid` file. If this fails manually kill `postgres.exe`:

```powershell
Stop-Process -Name "postgres" -Force
```
Then delete the `postmaster.pid` file in the data directory if it still exists before restarting the app.

## Gateway Health Check or Ollama Timeouts (Windows IPv6 `::1` Resolution)

When running the application on Windows, using `http://localhost:<port>` to perform health checks or to connect to local services (like Docker Gateway or Ollama) can result in hanging requests or slow timeouts (e.g., 3-5 seconds per request). This is because modern Windows environments resolve `localhost` to the IPv6 loopback address `::1` before trying the IPv4 address `127.0.0.1`.

If the target service (e.g., Docker port mapping or Ollama server) is only binding to IPv4, the initial connection to `::1` will either be silently dropped or refused, causing the request to hang until the `reqwest` or `fetch` timeout is reached. 

**Symptoms:**
- The Desktop UI reports "Gateway Unhealthy. The gateway container is running but not responding to health checks."
- Ollama test connection buttons or model listings take more than 3 seconds to respond or fail entirely.

**Resolution:**
- Always use `http://127.0.0.1:<port>` instead of `http://localhost:<port>` in frontend (`ConnectOllama.tsx`), Tauri commands (`chat.rs`), and raw health probes (`probe_health` in `gateway.rs`). This forces IPv4 and instantly bypasses the local DNS resolution delay.

## Gateway Container "Unhealthy" (Port Mapping Mismatch)

When using a custom HTTP port in the Desktop UI (e.g., `18789`), the `docker-compose.yml` generation must accurately reflect this mapping. 

**Root Cause:**
1. The user configures `OPENCLAW_HTTP_PORT=18789`.
2. The Desktop correctly attempts to health check `127.0.0.1:18789`.
3. If the generated `docker-compose.yml` incorrectly hardcodes `8080:8080`, the container will listen on `8080`, while the Desktop pings `18789`.

**Resolution:**
- Ensure `generate_compose_content` in `gateway.rs` uses the dynamic `http_port` to create a mapping like `18789:8080` (where `8080` is the fixed internal container port).

## Gateway Health Check Body Match (ok vs healthy)

The Desktop's internal health check logic performs a raw TCP probe and inspects the HTTP response body.

**Root Cause:**
- If the probe is hardcoded to look for the string `"healthy"` but the Gateway API returns `{"status":"ok"}`, the health check will fail and mark the container as "Unhealthy" even if the server is running perfectly.

**Resolution:**
- The `probe_health` function in `gateway.rs` must be updated to look for `"ok"` instead of `"healthy"`.

## Production Data Persistence (openclaw_home Volume)

Default Docker Compose setups often use ephemeral storage by default. To ensure your database, sessions, and configurations persist across Gateway updates or container restarts, a volume is required.

**Implementation:**
- The OpenClaw production compose setup uses a named volume `openclaw_home` mapped to `/home/node`. This ensures `~/.openclaw` data inside the container is stored safely on the host's Docker volume system.

## Ollama Model Detection Returning Empty Result

By design, the OpenClaw wizard requires a locally hosted Ollama instance to list its available models. Sometimes, the wizard may successfully connect to Ollama but the models list remains empty.

**Symptoms:**
- The connect step displays "Test Successful" but the "Installed Models" list shows zero items.

**Resolution:**
- This typically means that the actual Ollama installation on the host machine has zero models pulled.
- You can verify the raw JSON returned by Ollama manually:
  ```powershell
  (Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags").models
  ```
- If this returns an empty array `{}`, then Ollama is reachable but there are no models physically present on the machine. You must run `ollama run <model>` manually or use the Wizard's Pull option to download one.
