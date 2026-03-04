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
- URL resolution is dynamic and uses:
  - configured gateway port from installer state (`OPENCLAW_HTTP_PORT`, default `8080`)
  - Control UI base path from gateway capabilities (`/api/v1/capabilities`, default `/openclaw`)
- Effective in-app URL format:
  - `http://127.0.0.1:<port><base_path>/`
- If embedded rendering is blocked, use **Open In-App Window** (Tauri webview) or **Open Browser**.

### Runtime capability discovery
- Desktop queries `get_runtime_capabilities` (Tauri command).
- Command reads gateway capability data from:
  - `GET http://127.0.0.1:<port>/api/v1/capabilities`
- Returned sections are runtime-driven (no hardcoded desktop lists):
  - channels
  - tools
  - orchestrators
- If gateway is not running or endpoint is unavailable, desktop returns a safe empty structure.

### Safe Mode posture
- Gateway compose is started with `OPENCLAW_SAFE_MODE=1`.
- In Safe Mode, plugin discovery is limited to bundled plugins by upstream runtime policy.
- Desktop marks network-scoped tools as blocked when `allow_internet=false`.

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
- Secrets are not stored yet.
- The wizard UI is a placeholder for upcoming steps.

## Troubleshooting
- If `tauri:dev` fails, confirm Rust is installed and in PATH.
- If the window does not open, verify the dev server is running on port 1420.
- If Console is blank:
  - confirm gateway is running and healthy (`check_gateway_health`)
  - confirm configured HTTP port is reachable (`http://127.0.0.1:<port>/health`)
  - confirm Control UI base path (`/openclaw` by default)
  - if iframe embedding is blocked, use **Open In-App Window**
- If capabilities are empty while gateway is running:
  - check `http://127.0.0.1:<port>/api/v1/capabilities`
  - if auth/proxy rules block it, local desktop fallback remains safe-empty
