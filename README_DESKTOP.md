# OpenClaw Secure Installer Desktop

## Overview
This folder contains the Windows desktop app scaffold for the Secure Installer MVP.
Step 2 adds a Docker Desktop verification command (checkDocker) and a basic UI
surface for its result. Docker orchestration and secrets storage will be added in
later steps.

## Prerequisites Windows
- Node.js 22.12+ (or 20.19+)
- pnpm 10
- Rust toolchain (stable) via rustup (cargo + rustc)
- Windows: Visual Studio Build Tools with the Desktop C++ workload
- Docker Desktop for the final product flow

Verify versions:

```text
node -v
pnpm -v
cargo -V
rustc -V
```

Optional DX check (pnpm has a built-in doctor command, so use run):

```text
pnpm --dir desktop run doctor
```

If Node is below 22.12 (or 20.19), Vite will refuse to start. Upgrade Node and retry.

## Windows: cargo not found
The desktop preflight runs before `pnpm -C desktop tauri:dev` and
`pnpm -C desktop tauri:build`. On Windows, it
automatically tries to add these locations to PATH for the current run:
- `%USERPROFILE%\\.cargo\\bin`
- `%CARGO_HOME%\\bin` (if set)

If cargo is still not found, verify the PATH and reopen the terminal:

```text
where.exe cargo
where.exe rustc
```

Rustup installs cargo under `%USERPROFILE%\\.cargo\\bin` by default. If you
update PATH, close and reopen the terminal before retrying.

Manual verification commands:

```text
pnpm --dir desktop run doctor
pnpm -C desktop tauri:dev
```

## Test sequence
From the repo root:

```text
pnpm --filter ./desktop... install
pnpm -C desktop run doctor
pnpm -C desktop tauri:dev
```

## Development
From the repo root:

```text
pnpm --dir desktop run doctor
pnpm --dir desktop tauri:dev
```

This starts the Vite dev server and the Tauri shell.

## OpenClaw Console (Phase 1)
- The desktop app now includes an **OpenClaw Console** page that loads the upstream gateway Control UI directly.
- Upstream Control UI source in this repo:
  - project: `ui/`
  - build command: `pnpm ui:build`
  - build output: `dist/control-ui/` (served by gateway HTTP server)
- URL resolution is dynamic and uses:
  - configured gateway port from installer state (`OPENCLAW_HTTP_PORT`, default `8080`)
  - Control UI base path from gateway capabilities (`/api/v1/capabilities`, default `/openclaw` when UI assets are present)
  - If UI assets are missing, capabilities returns `control_ui.base_path=""` (safe empty)
  - Control UI auto-probe fallback candidates when capability path is missing/non-HTML: `/`, `/openclaw/`, `/ui/`, `/console/`, `/app/`
- Effective in-app URL format:
  - `http://127.0.0.1:<port><base_path>/`
- Console opens in a dedicated **Tauri WebviewWindow** by default (Windows reliability-first).
- Browser open remains available as a fallback.

### Gateway binding defaults
- Gateway port publish is localhost-only by default:
  - compose mapping uses `OPENCLAW_BIND_HOST` with default `127.0.0.1`
- Desktop stores gateway auth secret in OS keychain (Windows Credential Manager):
  - key id: `gateway.auth.token`
  - `.env` stores only non-secret identifiers (`OPENCLAW_GATEWAY_TOKEN_REF=keychain:gateway.auth.token`)
  - legacy `.env` `OPENCLAW_GATEWAY_TOKEN` is imported once into keychain, then removed from `.env`
- At gateway startup, desktop injects runtime-only env vars to `docker compose up`:
  - `OPENCLAW_GATEWAY_TOKEN`
  - `OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN` (cookie bootstrap token for this session)
- Installer includes an explicit advanced toggle:
  - **Expose gateway to LAN**
  - enabled = `OPENCLAW_BIND_HOST=0.0.0.0`
  - disabled (default) = `OPENCLAW_BIND_HOST=127.0.0.1`
- Only enable LAN exposure if remote clients are required and firewall policy is in place.

### Runtime capability discovery
- Desktop queries `get_runtime_capabilities` (Tauri command).
- Command reads gateway capability data from:
  - `GET http://127.0.0.1:<port>/api/v1/capabilities`
- Returned sections are runtime-driven (no hardcoded desktop lists):
  - channels
  - tools
  - orchestrators
- Capabilities now also advertise Control UI auth posture:
  - `control_ui.auth_required`
  - `control_ui.auth_mode` (`cookie` by default in desktop flow)
  - `control_ui.insecure_fallback`
- If gateway is not running or endpoint is unavailable, desktop returns a safe empty structure.

### Local auth for Console
- Desktop opens Console through a local bootstrap route:
  - `GET /api/v1/local-auth/bootstrap?token=<runtime-token>&next=/openclaw/`
- Gateway validates the bootstrap token (local-only), then sets:
  - `openclaw_local_session` cookie (`HttpOnly`, `SameSite=Strict`)
- Upstream Control UI then uses normal same-origin requests (HTTP + WS) without storing gateway token in UI JavaScript.
- If cookie bootstrap is unavailable, Console shows an explicit insecure-fallback warning.

## Connections (Phase 2 no-code setup)
- Desktop now includes a **Connections** page for runtime-discovered no-code setup.
- Source of truth is gateway runtime discovery (no hardcoded desktop channel/provider lists):
  - `GET /api/v1/connections/schema`
  - `GET /api/v1/connections/status`
- Configure and test actions are cookie-auth protected local endpoints:
  - `POST /api/v1/connections/:kind/:id/configure`
  - `POST /api/v1/connections/:kind/:id/test`
- Current first integrations:
  - Telegram channel (`bot_token`, optional `default_chat_id`)
  - OpenAI-compatible provider (`api_key`, optional `base_url`, optional `model`)

### Secrets model for Connections
- Desktop stores connection secrets in OS keychain (Windows Credential Manager).
- Configure requests send `secret_refs` (for example `connections.provider.openai.api_key`) rather than plaintext persistence.
- Gateway config/state stores keychain reference placeholders (for example `keychain://connections.provider.openai.api_key`) and never writes raw secrets to `.env`.
- Runtime tests may use plaintext secret values in loopback request bodies only; those values are not persisted in gateway config files.

### Safe Mode behavior for Connections
- In Safe Mode with `allow_internet=false`, networked connection tests return policy-blocked results.
- The schema advertises this via `test_capabilities.blocked_by_policy`, and status surfaces the last blocked error.

### Safe Mode posture
- Gateway compose is started with `OPENCLAW_SAFE_MODE=1`.
- In Safe Mode, plugin discovery is limited to bundled plugins by upstream runtime policy.
- Desktop capability response keeps `scope` unchanged and sets `blocked_by_policy=true` when `allow_internet=false`.

### checkDocker behavior
checkDocker verifies:
- Docker CLI presence (`docker --version`)
- Docker daemon reachability (`docker info`)
- Docker Compose v2 availability (`docker compose version`)
- Docker server version (`docker version --format "{{.Server.Version}}"`)

If any check fails, a short remediation message is displayed in the UI:
- Docker CLI missing: install Docker Desktop
- Daemon unreachable: start Docker Desktop
- Compose v2 missing: update Docker Desktop

To test in dev: run `pnpm --dir desktop tauri:dev`, click **Check Docker** in the UI,
and confirm the status pills, versions, remediation, and diagnostics update.

## Build
From the repo root:

```text
pnpm --dir desktop install
pnpm --dir desktop tauri:build
```

Bundle output is placed under `desktop/src-tauri/target/release/bundle`.

## Limitations
- Orchestration commands are not implemented yet.
- Browser fallback opened directly to root may require manual auth if no session cookie is present.
- The wizard UI is a placeholder for upcoming steps.

## Troubleshooting
- If `tauri:dev` fails, confirm Rust is installed and in PATH.
- If the window does not open, verify the dev server is running on port 1420.
- If Console is blank:
  - confirm gateway is running and healthy (`check_gateway_health`)
  - confirm configured HTTP port is reachable (`http://127.0.0.1:<port>/health`)
  - confirm Control UI route is reachable (`http://127.0.0.1:<port>/openclaw/`)
  - confirm capabilities reports base path (`http://127.0.0.1:<port>/api/v1/capabilities`)
  - if Console diagnostic says no HTML route found, this gateway image does not bundle Control UI
  - rebuild/update gateway image with Control UI or run a separate control-ui service
  - use **Open In-App Window** to refocus/reopen the dedicated Console window
- If gateway should be local-only but is reachable from another host:
  - verify `OPENCLAW_BIND_HOST=127.0.0.1` in app data `.env`
  - disable **Expose gateway to LAN** in installer/settings and restart gateway
- To verify LAN exposure is off by default:
  - inspect published ports: `docker ps --format "{{.Names}} {{.Ports}}" | findstr gateway`
  - expected host binding: `127.0.0.1:<port>->8080/tcp` (not `0.0.0.0`)
- If capabilities are empty while gateway is running:
  - check `http://127.0.0.1:<port>/api/v1/capabilities`
  - if auth/proxy rules block it, local desktop fallback remains safe-empty
- If Connections configure fails with `bot_token is required` or `api_key is required`:
  - enter the secret in the Setup form once and click **Save Setup**
  - desktop writes the secret to keychain and resends configure using `secret_refs`
  - retry **Test** after saving
- If Connection test returns blocked by policy:
  - keep Safe Mode and enable internet only when explicitly needed
  - set installer/runtime `allow_internet=true` and restart gateway to permit network tests

## Windows e2e command
Use the Windows-safe runner (sets `TMP`/`TEMP` to a workspace-local folder and defaults Vitest pool to `threads`):

```text
pnpm test:e2e:windows
```

Run only the new Connections gateway test:

```text
pnpm test:e2e:windows -- src/gateway/connections-http.e2e.test.ts
```

Optional overrides:

```text
$env:OPENCLAW_TEST_TMP='D:\tmp\openclaw-vitest'; pnpm test:e2e:windows
$env:OPENCLAW_E2E_POOL='forks'; pnpm test:e2e:windows
```

If `spawn EPERM` still occurs, your environment may block child-process execution (for example AppLocker/AV policy on `node_modules\esbuild`). Use an allowlisted workspace path and retry.
