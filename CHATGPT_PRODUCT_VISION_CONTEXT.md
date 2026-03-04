# OpenClaw Product Vision Context Pack

This file is a structured snapshot of project state for planning product vision with ChatGPT.
It is intentionally factual, source-linked, and split between:

- What exists now (verified)
- What is unstable or missing
- What decisions are needed next

---

## 1) Snapshot Metadata

- Snapshot date: 2026-03-04
- Repository: `openclaw-secure-installer` (based on `openclaw/openclaw`)
- Branch: `main`
- HEAD commit: `3c1f1d955`
- Core package version: `openclaw@2026.2.6-3` ([package.json](./package.json))
- Desktop package version: `openclaw-secure-installer-desktop@0.2.0` ([desktop/package.json](./desktop/package.json))
- Runtime baseline: Node `>=22.12.0` ([package.json](./package.json))

Working tree currently has local changes in:

- [desktop/src-tauri/src/gateway.rs](./desktop/src-tauri/src/gateway.rs)
- [desktop/src-tauri/src/main.rs](./desktop/src-tauri/src/main.rs)
- [desktop/src/components/steps/Step4Dashboard.tsx](./desktop/src/components/steps/Step4Dashboard.tsx)
- [desktop/src/lib/tauri.ts](./desktop/src/lib/tauri.ts)
- [desktop/src/pages/Providers.tsx](./desktop/src/pages/Providers.tsx)
- [src/security/audit.test.ts](./src/security/audit.test.ts)

---

## 2) What This Product Is (Verified)

### 2.1 Core OpenClaw (upstream model)

OpenClaw is a self-hosted, multi-channel AI assistant gateway.

- Single gateway process controls sessions, routing, channels, tools, and device nodes.
- Supports many channels (WhatsApp, Telegram, Slack, Discord, Signal, iMessage variants, WebChat, extensions).
- Includes CLI, web control UI, and mobile/macOS node surfaces.

Primary references:

- [README.md](./README.md)
- [docs/index.md](./docs/index.md)

### 2.2 This fork (`openclaw-secure-installer`)

This fork adds a secure installer/Mission Control direction:

- Windows-first desktop app (Tauri + React) to configure and operate gateway/agents.
- Docker-centered deployment model for gateway.
- Safe Mode hardening for restricted environments.

Primary references:

- [README_DESKTOP.md](./README_DESKTOP.md)
- [SAFE_MODE.md](./SAFE_MODE.md)
- [docs/SECURE_INSTALLER_VERIFICATION.md](./docs/SECURE_INSTALLER_VERIFICATION.md)

---

## 3) Architecture Overview (Current)

### 3.1 Monorepo shape

- Core TypeScript runtime and CLI under `src/`
- Desktop secure-installer UI under `desktop/`
- Tauri backend under `desktop/src-tauri/`
- Mobile/macOS apps under `apps/`
- Extensions/plugins under `extensions/`
- Documentation under `docs/`

### 3.2 Secure-installer runtime path

Current installer path (desktop):

1. Desktop app stores installer state (ports/image/flags).
2. Desktop app writes `.env` + `docker-compose.yml`.
3. Desktop app starts/stops Docker compose gateway.
4. Desktop app probes gateway health and shows operator UI.

State model details (verified):

- Default HTTP port `8080`, HTTPS `8443` ([desktop/src-tauri/src/state_manager.rs](./desktop/src-tauri/src/state_manager.rs))
- Default gateway image `ghcr.io/leojeulinmerville/openclaw-gateway:stable` ([desktop/src-tauri/src/state_manager.rs](./desktop/src-tauri/src/state_manager.rs))
- Default `allow_internet=false` and `stop_agents_on_gateway_stop=false` ([desktop/src-tauri/src/state_manager.rs](./desktop/src-tauri/src/state_manager.rs))

### 3.3 Safe Mode behavior

Safe Mode currently documents:

- Restricted process execution allowlist
- External plugin discovery disabled
- Shell profile/system-level modifications skipped

Reference:

- [SAFE_MODE.md](./SAFE_MODE.md)

---

## 4) Current Implementation State

### 4.1 Strong areas

- Very broad core product surface already exists (channels, routing, tools, nodes, docs).
- Security audit/test coverage in core is substantial.
- Desktop secure-installer has real backend commands for Docker checks, state, gateway lifecycle, health probes.
- Desktop builds and type-checks in isolation.

### 4.2 Maturity mismatch to resolve

There is currently a maturity split between:

- Core OpenClaw platform (large, production-like surface)
- Secure-installer desktop surfaces (partly MVP scaffolding, partly operational)

This is the primary product strategy tension to resolve.

---

## 5) Quality and Build Status (Verified in this snapshot)

### 5.1 Commands that passed

- `pnpm -s tsgo` (root type-level checks): pass
- `pnpm -s vitest run src/security/audit.test.ts`: pass (44/44)
- `pnpm --dir desktop -s lint` (`tsc --noEmit`): pass
- `cargo check` in `desktop/src-tauri`: pass (warnings only)
- `pnpm --dir desktop -s build`: pass

### 5.2 Commands that currently fail or are unstable

- `pnpm -s lint` (root): fails with 102 errors (mostly desktop and some gateway/openclaw.mjs style/type rules)
- `pnpm -s test` (root): timed out in long run and terminated with `EPIPE` during test runner output in this environment
- `pnpm -s build` (root): depends on bash-based steps and can fail on Windows environments without `/bin/bash`

---

## 6) Known Product/Engineering Issues (Current)

### Fixed in current working tree (not yet committed)

1. Desktop dashboard was opening browser on hardcoded port 80. Now uses configured state port.
2. Ollama wizard step 3 previously assumed gateway connectivity success. Now runs real gateway-container probe.
3. Security audit test on Windows locale was fragile (`icacls ... Everyone:W`). Now locale-safe in test setup.

Changed files:

- [desktop/src/components/steps/Step4Dashboard.tsx](./desktop/src/components/steps/Step4Dashboard.tsx)
- [desktop/src/pages/Providers.tsx](./desktop/src/pages/Providers.tsx)
- [desktop/src/lib/tauri.ts](./desktop/src/lib/tauri.ts)
- [desktop/src-tauri/src/gateway.rs](./desktop/src-tauri/src/gateway.rs)
- [desktop/src-tauri/src/main.rs](./desktop/src-tauri/src/main.rs)
- [src/security/audit.test.ts](./src/security/audit.test.ts)

### Still open / strategic debt

1. Root lint gate is red (102 errors), which blocks reliable CI gating confidence.
2. Windows dev path friction from bash-dependent root scripts.
3. Desktop app includes legacy MVP placeholders in some pages; feature quality is uneven.
4. Large scope breadth across channels/apps/extensions increases product focus risk.

---

## 7) Constraints and Guardrails

### Technical constraints

- Node baseline is `>=22.12.0`.
- Repo tooling expects `pnpm`.
- Some build/test flows rely on bash scripts.
- Desktop stack: Tauri v2 + React + TypeScript + Rust backend.
- Gateway container orchestration assumes Docker Desktop (in secure-installer path).

### Product/safety constraints

- Safe Mode is a core differentiator for secure-installer context.
- Security posture and explicit pairing/allowlist behavior are core to trust model.
- Multi-channel support is a core capability of OpenClaw, but may conflict with “secure installer” simplicity if not staged.

---

## 8) Product Decisions Needed Next

These are the highest-leverage vision decisions to settle first:

1. Product identity:
   Is this primarily a secure local runtime/operator cockpit, or a general OpenClaw desktop control center?
2. Primary user:
   Single-user local operator vs multi-agent power-user vs team admin.
3. North-star workflow:
   What is the one 10-minute success path to optimize (install -> run -> message -> trust)?
4. Scope boundary:
   Which core OpenClaw capabilities are in v1 secure-installer, and which are explicitly deferred?
5. Platform sequencing:
   Windows-first only, or parity targets with macOS/Linux for installer mode?
6. Quality bar:
   Which CI gates must be green before claiming “beta” for secure-installer?

---

## 9) Suggested Product Vision Workplan (for ChatGPT)

Ask ChatGPT to produce:

1. A clear product thesis statement (1 paragraph).
2. Two candidate product strategies (focused vs broad), with tradeoffs.
3. A 90-day roadmap with milestones, acceptance criteria, and kill criteria.
4. A quality stabilization plan tied to specific engineering gates.
5. A de-scoping matrix (must-have, should-have, defer).
6. A KPI framework:
   activation, reliability, security confidence, retention.

---

## 10) Copy-Paste Prompt for ChatGPT

Use this directly in ChatGPT:

```md
You are helping define product vision and roadmap for a project called OpenClaw Secure Installer.

Context:
- OpenClaw is a self-hosted multi-channel AI assistant gateway.
- This fork adds a Windows-first secure installer / Mission Control layer (Tauri desktop + Docker + Safe Mode posture).
- Current repo has broad capabilities but uneven product focus.
- Root lint currently fails (102 errors); root test run is unstable/timeouts in this environment.
- Desktop and security targeted checks pass.

Primary objective:
Design a focused product vision and execution plan that can ship a credible beta quickly, without losing long-term platform optionality.

Please deliver:
1) Product thesis and target user definition
2) Two strategy options with tradeoffs (focus vs breadth)
3) Recommended strategy and why
4) 90-day roadmap with concrete milestones and acceptance criteria
5) De-scope list (what to explicitly not do now)
6) KPI framework and instrumentation recommendations
7) Top risks and mitigations (technical + product + operational)

Important:
- Do not assume infinite engineering capacity.
- Optimize for shipping and reliability.
- Keep security and trust posture central.
- Include clear decision points and “if X then Y” branching.
```

---

## 11) Additional References (Repo-local)

- Core docs:
  - [README.md](./README.md)
  - [docs/index.md](./docs/index.md)
- Secure installer docs:
  - [README_DESKTOP.md](./README_DESKTOP.md)
  - [SAFE_MODE.md](./SAFE_MODE.md)
  - [docs/SECURE_INSTALLER_VERIFICATION.md](./docs/SECURE_INSTALLER_VERIFICATION.md)
- Desktop implementation:
  - [desktop/src](./desktop/src)
  - [desktop/src-tauri/src](./desktop/src-tauri/src)

