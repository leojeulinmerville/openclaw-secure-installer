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
