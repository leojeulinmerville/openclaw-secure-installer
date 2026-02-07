# OpenClaw Secure Installer Desktop

## Overview
This folder contains the Windows desktop app scaffold for the Secure Installer MVP.
The UI is a minimal placeholder for Step 1. Docker orchestration and secrets storage
will be added in later steps.

## Prerequisites
- Node.js 22 or newer
- pnpm 10
- Rust toolchain (stable) via rustup
- Windows: Visual Studio Build Tools with the Desktop C++ workload
- Docker Desktop for the final product flow

## Development
From the repo root:

```text
pnpm --dir desktop install
pnpm --dir desktop tauri:dev
```

This starts the Vite dev server and the Tauri shell.

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
