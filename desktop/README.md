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
4. **Run** — View status, health check, logs, stop/restart

### Gateway Image Distribution

The gateway container must include **Node.js** and the **OpenClaw gateway app** (`openclaw.mjs`).
A minimal reference gateway is included in the `gateway/` directory of this repo.

| Mode | Description |
|------|-------------|
| **Public Image** | Use the default `ghcr.io/leojeulinmerville/openclaw-gateway:stable` or any compatible GHCR image. If pull is denied, run `docker login ghcr.io` with a PAT that has `read:packages`. |
| **Private Registry** | Enter registry URL + image name. "Copy Login Command" gives you the `docker login` command to run first. |
| **Local Build** | Point to the `gateway/` directory. "Build Locally" creates `openclaw-gateway:dev` and wires it into the compose file. |

### Developer Local Build

To build and run the gateway locally from a fresh clone:

```powershell
# 1. Start the Tauri app
pnpm -C desktop tauri:dev

# 2. In the wizard (Step 3), switch to "Local Build" tab
# 3. Enter the path to the gateway/ directory: <repo-root>\gateway
# 4. Click "Build Locally" → builds openclaw-gateway:dev
# 5. Click "Start Gateway" → container starts, /health is probed
```

Or manually:

```powershell
docker build -t openclaw-gateway:dev ./gateway
```

The gateway exposes:
- `GET /health` → `{"status":"healthy","uptime_ms":...,"version":"0.1.0-mvp"}`
- `GET /` → service info

### Docker Smoke Test

Step 3 includes an independent **Docker Smoke Test** button that runs `docker run --rm hello-world`.
This does **not** affect gateway settings and is useful for verifying Docker connectivity.

### Container Health Verification

After `docker compose up -d`, the app verifies stability using `docker inspect`:
- Resolves the gateway container ID via `docker compose ps -q gateway`
- Reads `Status`, `Restarting`, and `ExitCode` from `docker inspect`
- A container is **healthy** only if: `Status == "running"` AND `Restarting == false` AND `ExitCode == 0`
- **Stability window**: two checks 1500ms apart must both pass
- After stability, probes `GET /health` on the configured HTTP port
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
