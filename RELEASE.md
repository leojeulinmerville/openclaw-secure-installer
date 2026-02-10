# Release Checklist

This document describes how to build, test, and publish the OpenClaw Secure Installer
for Windows, plus the companion gateway Docker image.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 22 LTS | `node -v` |
| pnpm | 9+ | `pnpm -v` |
| Rust | stable | `rustc --version` |
| VS Build Tools | 2022+ | `cl` available in PATH |
| Docker Desktop | 4.x | `docker --version` |

> **Tip:** Run `pnpm -C desktop doctor` to check Node + pnpm versions.

---

## 1. Build the Desktop Installer (Local)

```powershell
# Install dependencies
pnpm --filter ./desktop... install

# Run tests first
cd desktop/src-tauri && cargo test && cd ../..

# Build the release installer (MSI + NSIS exe)
pnpm -C desktop tauri:build
```

### Where to find the artifacts

| Format | Path |
|--------|------|
| MSI | `desktop/src-tauri/target/release/bundle/msi/OpenClaw Secure Installer_0.1.0_x64_en-US.msi` |
| NSIS | `desktop/src-tauri/target/release/bundle/nsis/OpenClaw Secure Installer_0.1.0_x64-setup.exe` |

---

## 2. Test the Installer (Fresh Machine)

1. Copy the `.msi` or `.exe` to a clean Windows machine (or VM).
2. Run the installer — follow the prompts.
3. Launch **OpenClaw Secure Installer** from Start Menu.
4. **Step 1 — System Check**: Click "Check System" → all three pills should show OK.
5. **Step 2 — Configure**: Leave defaults (HTTP 80, HTTPS 443) → Next.
6. **Step 3 — Install**:
   - **Docker Smoke Test**: Click → should show "Docker OK ✓".
   - **Public Image** tab should default to `ghcr.io/leojeulinmerville/openclaw-gateway:stable`.
   - Click **Start Gateway** → stability check + /health probe.
7. **Step 4 — Run**: Click "Check /health" → "Healthy ✓".

> **If the gateway image is not yet published**, use the **Local Build** tab:
> point it to the `gateway/` directory in the repo and click "Build Locally".

---

## 3. Build & Push the Gateway Image

### Automated (CI)

Push a semver tag to trigger the `gateway-publish.yml` workflow:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This builds `ghcr.io/leojeulinmerville/openclaw-gateway:0.1.0` + `:stable` + `:sha-<commit>`.

### Manual

```bash
cd gateway
docker build -t ghcr.io/leojeulinmerville/openclaw-gateway:stable .
docker push ghcr.io/leojeulinmerville/openclaw-gateway:stable
```

> Requires `docker login ghcr.io -u <user> --password-stdin` with a PAT that has `write:packages`.

---

## 4. Create a GitHub Release

### Automated (CI)

Push a `v*` tag → `desktop-build.yml` runs and creates a **draft** release with the MSI/NSIS exe attached.

1. Go to **Releases** on GitHub.
2. Edit the draft — add release notes.
3. Publish.

### Manual

1. Build locally (step 1).
2. Create a release on GitHub.
3. Upload the MSI and exe from `target/release/bundle/`.

---

## 5. Code Signing (Future)

The installer is currently **unsigned**. Windows SmartScreen will show a warning on first run.

To add signing later:

1. Obtain an EV code signing certificate.
2. Set `certificateThumbprint` in `tauri.conf.json` → `bundle.windows`.
3. Set `TAURI_SIGNING_PRIVATE_KEY` secret in GitHub Actions.
4. See: https://v2.tauri.app/distribute/sign/windows/

---

## Version Bump

Before a release, update version in:

1. `desktop/src-tauri/tauri.conf.json` → `"version"`
2. `desktop/package.json` → `"version"`
3. `desktop/src-tauri/Cargo.toml` → `version`
