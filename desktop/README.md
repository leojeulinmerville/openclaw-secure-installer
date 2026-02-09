# OpenClaw Desktop (Tauri)

This directory contains the Tauri-based desktop application for OpenClaw.

## Prerequisites

- Node.js 18+
- pnpm
- Rust toolchain (rustc, cargo)
- Tauri CLI: `cargo install tauri-cli`

## Development

```bash
# From repo root
pnpm --filter ./desktop... install
pnpm -C desktop tauri:dev
```

## Wizard Flow

The app guides users through a 4-step no-code installer:

1. **System Check** — Detects Docker CLI, daemon, and Compose v2
2. **Configure** — Set HTTP/HTTPS ports, safe mode (enforced), storage path
3. **Install** — Select image source and start the gateway
4. **Run** — View status, logs, stop/restart

### Image Source Selection (Step 3)

Three modes for choosing the gateway container image:

| Mode | Description |
|------|-------------|
| **Public Image** | Enter a fully-qualified image (e.g. `ghcr.io/openclaw-ai/openclaw-gateway:stable`). Use "Test Pull Access" to validate before starting. |
| **Private Registry** | Enter registry URL + image name. "Copy Login Command" gives you the `docker login` command to run first. |
| **Local Build** | Point to a build context directory. "Build Locally" creates `openclaw:dev` and wires it into the compose file. |

### State Machine

- On app launch, `is_gateway_running()` is called to sync UI with reality
- If gateway is already running → skip directly to Step 4
- If `start_gateway` is called while running → returns `already_running` status
- If start fails but container is running (e.g. old container) → Step 4 + warning banner
- If start fails and nothing running → Step 3 + blocking error card

### Running Tests

```powershell
cd desktop/src-tauri
cargo test
```

## Windows Troubleshooting

### "gen folder access denied" / Failed to determine package fingerprint

If you see errors like:

```
Failed to read directory ... desktop/src-tauri/gen/schemas
Access denied (os error 5)
```

**Cause**: The `gen` folder may have incorrect permissions, often caused by running build commands with elevated privileges (admin) or Windows Defender/indexer locks.

**Solutions**:

1. **Run the repair script**:
   ```powershell
   .\scripts\fix-tauri-gen-perms.ps1
   ```

2. **Or manually fix**:
   ```powershell
   # Take ownership
   takeown /f desktop\src-tauri\gen /r /d y
   
   # Grant full control
   icacls desktop\src-tauri\gen /grant "$env:USERNAME:(OI)(CI)F" /t
   
   # Remove attributes
   attrib -r -s -h desktop\src-tauri\gen /s /d
   ```

3. **Nuclear option** - delete and let Tauri regenerate:
   ```powershell
   Remove-Item -Recurse -Force desktop\src-tauri\gen
   pnpm -C desktop tauri:dev
   ```

### Verify your toolchain

```powershell
where.exe cargo
where.exe rustc
cargo --version
rustc --version
```

## Build for Production

```bash
pnpm -C desktop tauri:build
```

Output will be in `desktop/src-tauri/target/release/bundle/`.
