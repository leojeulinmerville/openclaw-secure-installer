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
3. **Install** — Select gateway image source and start the gateway
4. **Run** — View status, logs, stop/restart

### Gateway Runtime Image (Step 3)

Three modes for choosing the gateway container image. **The image must be gateway-compatible** (includes Node.js + gateway app). Do not use generic images like `nginx:alpine` or `alpine` — they will fail with exit code 127 ("node: not found").

| Mode | Description |
|------|-------------|
| **Public Image** | Enter a fully-qualified image (e.g. `ghcr.io/openclaw-ai/openclaw-gateway:stable`). Use "Test Pull Access" to validate before starting. |
| **Private Registry** | Enter registry URL + image name. "Copy Login Command" gives you the `docker login` command to run first. |
| **Local Build** | Point to a build context directory. "Build Locally" creates `openclaw:dev` and wires it into the compose file. |

### Docker Smoke Test

Step 3 includes an independent **Docker Smoke Test** button that runs `docker run --rm hello-world` to verify Docker can pull and run containers. This does **not** affect gateway settings and is useful for troubleshooting.

### Container Health Verification

After `docker compose up -d`, the app verifies stability using `docker inspect`:
- Resolves the gateway container ID via `docker compose ps -q gateway`
- Reads `Status`, `Restarting`, and `ExitCode` from `docker inspect`
- A container is considered **healthy** only if: `Status == "running"` AND `Restarting == false` AND `ExitCode == 0`
- **Stability window**: two checks 1500ms apart must both pass
- Containers in a restart loop (e.g. exit 127) are correctly detected as **failed**

### State Machine

- On app launch, `is_gateway_running()` syncs UI with actual Docker state
- If gateway is already running and healthy → skip to Step 4
- If `start_gateway` is called while running → returns `already_running`
- If start fails but container is healthy → Step 4 + warning banner
- If start fails and not healthy → Step 3 + blocking error card (with pattern-matched remediation)

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
