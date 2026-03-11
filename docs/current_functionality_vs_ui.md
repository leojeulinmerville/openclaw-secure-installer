# Current Functionality vs UI Reality

## Fully Functional Features (End-to-End)

| Feature | Backend Support | UI Status | File Reference |
| :--- | :--- | :--- | :--- |
| **Gateway Management** | Docker Compose orchestration. | Complete (Overview, Setup). | `gateway.rs`, `Overview.tsx`. |
| **Agent Lifecycle** | CLI `agents add` / `list` / `remove`. | Complete (AgentsList, CreateAgent). | `agents.rs`, `AgentsList.tsx`. |
| **Run Execution** | Background process calling CLI. | Active (Runs, RunDetail). | `runs.rs`, `RunDetail.tsx`. |
| **WhatsApp Channel** | Baileys integration in Gateway. | Active (Connections/Pairing). | `channels.rs`, `Connections.tsx`. |
| **Local LLM Discovery** | Ollama/LM Studio API calls. | Active (ConnectOllama, Providers). | `chat.rs`, `ConnectOllama.tsx`. |
| **State Persistence** | `state.json` sync. | Complete (Settings). | `state_manager.rs`, `Settings.tsx`. |

## Partially Functional / Simulated Features

| Feature | Backend Support | UI Status | Observation |
| :--- | :--- | :--- | :--- |
| **Egress Allowlist** | Controlled by `openclaw-egress` network. | Read-only Display (Policies). | Network existence is ensured, but UI shows static data. |
| **Patch Application** | `apply_patch_safely` in Rust. | Integrated in Run flow. | Requires specific `PATCH.diff` artifact to trigger. |
| **Chat Interaction** | `chat_send` in Rust. | Functional for basic interaction. | Different from "Runs" - more of a playground. |

## Mocked / UI-Only Features

| Feature | Current State | File Reference |
| :--- | :--- | :--- |
| **Cost Tracking** | Returns `formatCost(0)` for all metrics. | `Overview.tsx` |
| **Alerts System** | Hardcoded empty array `MOCK_ALERTS`. | `Overview.tsx` |
| **Security Policies** | Mostly static display of "Enforced" status. | `Policies.tsx` |
| **Cost Caps** | Disabled in UI, "Coming in v1.1.0". | `Policies.tsx` |
| **Tailscale Integration** | "Not configured" / "Optional" status only. | `Overview.tsx` |

## Summary of Parity Gaps
- **Backend without UI**:
  - Many CLI options (`--local-auth`, `--profile`, etc.) are not exposed in the Desktop UI.
  - The Gateway supports many more channels (Slack, Discord, Telegram) than are currently easily configurable in the Desktop app (which focuses on WhatsApp/Ollama).
- **UI without Backend**:
  - The `Policies` page is a conceptual placeholder for future governance features.
  - Cost and resource monitoring is mostly static and lacks a real-time data provider from the CLI runs.
