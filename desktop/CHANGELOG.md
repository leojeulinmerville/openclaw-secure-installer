# Changelog

## v0.2.2 - 2026-03-05

### Fixes — CI/CD reliability sprint

- **P0 — Gateway Dockerfile** `gateway/Dockerfile` was the upstream OpenClaw monorepo
  Dockerfile (referenced `pnpm-workspace.yaml`, `ui/`, `patches/`, `scripts/`, `pnpm build`)
  which don't exist in this repo. Replaced with a **minimal single-stage image** that simply
  copies `openclaw.mjs` and runs it with `node`. Adds a `HEALTHCHECK` instruction.
- **P0 — Desktop release assets**: `desktop-build.yml` was creating `draft: true` releases.
  Changed to `draft: false`. Fixed NSIS glob to `*-setup.exe`. Releases are now immediately
  published with MSI + EXE as downloadable assets. Added `generate_release_notes: true`
  and auto-prerelease detection for `-beta`/`-rc`/`-alpha` tags.
- **P1 — Preflight workflow**: Added `.github/workflows/preflight.yml` — a manual
  `workflow_dispatch` workflow that runs the identical build steps (install → tests → build →
  Tauri build) but **does not create a GitHub Release**. Uploads MSI + EXE as run-numbered
  artifacts for validation before tagging. Also validates the gateway Docker build (no push).
- **P1 — Local preflight script**: Added `scripts/release-preflight.ps1` for Windows
  developers. Runs all release steps locally: `pnpm install`, `cargo test`, `pnpm build`,
  `tauri:build`. Supports `-SkipTests` and `-SkipBuild` flags for fast iteration.

### Version
- Bumped to `0.2.2` in `tauri.conf.json`, `package.json`, `Cargo.toml`.

---

## v0.2.1 - 2026-03-05



### Fixes (hotfix sprint)
- **P0 — Start Gateway regression**: `GatewayBanner` now reads the `GatewayStartResult` and surfaces `userFriendlyTitle`, `userFriendlyMessage`, remediation steps, and a collapsible diagnostics panel instead of silently swallowing errors. Added Retry button on failure state.
- **P0 — AgentDetail crash/freeze**: Consolidated polling loops behind a single `mountedRef` + `document.visibilityState` guard with proper interval cleanup on unmount. Tab-adaptive intervals (5s metrics, 6s logs, 8s overview). Crash-loop watchdog scoped to overview tab only.
- **P0 — CI release workflows already correct**: Both `desktop-build.yml` and `gateway-publish.yml` already trigger on `v*` tag push with correct `pnpm --filter` and multi-arch Docker build. Updated `RELEASE.md` to document correct `--manifest-path` for `cargo test`.
- **P1 — Ollama onboarding**: `ConnectOllama` gains a **Test Completion** step with model selector and latency display. Curated model list (Llama 3.2 1B, Gemma 3 1B, Phi-4 Mini, Llama 3.1 8B) with pull progress bar. Removed terminal instructions; replaced with "Start from system tray" guidance.

### Security
- **Address Normalization**: Forced `127.0.0.1` instead of `localhost` in Ollama API base to prevent Windows IPv6 resolution issues (from v0.2.0).
- **Insecurity Removal**: Removed instructions to set `OLLAMA_ORIGINS="*"` (from v0.2.0).

### CI/CD
- **Build Stability**: `CARGO_BUILD_JOBS: 1` in Windows build workflow prevents `Peer disconnected` OOM crashes (from v0.2.0).

### Tests
- Added `test_start_gateway_missing_compose_result_is_structured`: verifies the "missing compose file → actionable error" contract that was the root cause of the silent-cancel regression.
- Added `test_failed_result_is_not_active`: regression guard ensuring all failure variants have non-empty title, message, and remediation steps.

---



## v0.1.8 - 2026-02-11

### Features
- **Real Run Engine**: Implemented end-to-end run execution with real LLM calls (OpenAI/Ollama).
- **Safe Patching**: Added `patch.rs` for safe, confined `git apply` operations on the workspace.
- **Ollama Onboarding**: New wizard for connecting to local Ollama instances.
- **Agents List**: Optimized polling frequency for better performance.

### Fixes
- **Build**: Fixed serialization issues in LLM module.
- **UX**: Improved connectivity checks and error handling.
