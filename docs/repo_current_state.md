# Repo Current State - Technical Audit

## Top Level Folders

| Folder | Purpose |
| :--- | :--- |
| `apps/` | Mobile and Desktop native apps (Android, iOS, macOS). |
| `desktop/` | **Primary No-Code Interface**. Tauri + React application. |
| `src/` | **Core Engine & Gateway**. Contains the business logic for the CLI and the API Gateway. |
| `extensions/` | System extensions for channels (WhatsApp, Slack, etc.), providers, and tools. |
| `packages/` | Internal shared libraries. |
| `ui/` | Shared UI components (likely for the canvas or other web parts). |
| `docs/` | Project documentation. |
| `scripts/` | Build and utility scripts. |

## Sub-systems Mapping

### 1. Control Plane (Desktop App)
- **Tech Stack**: Tauri (Rust) + React (TypeScript) + TailwindCSS.
- **Role**: Manages the local environment (Docker, Gateway), agent lifecycle, and provides the "no-code" UI.
- **Point of Truth**: `state.json` in the user's app data directory.
- **Key Files**: `desktop/src-tauri/src/main.rs`, `desktop/src/pages/`.

### 2. Execution Engine (CLI / Daemon)
- **Tech Stack**: Node.js (TypeScript).
- **Role**: Executes the actual agent logic, tool calls, and LLM interactions.
- **Point of Truth**: `runs/` directory (per-run `meta.json` and `events.jsonl`).
- **Key Files**: `openclaw.mjs`, `src/entry.ts`, `src/agents/`.

### 3. Communication Gateway
- **Tech Stack**: Node.js (Hono/Express).
- **Role**: Mediates between LLM providers and various communication channels.
- **Deployment**: Typically runs inside a Docker container managed by the Desktop app.
- **Key Files**: `src/gateway/server-http.ts`, `src/gateway/auth.ts`.

### 4. Extensions System
- **Role**: Pluggable architecture for adding new capabilities.
- **Categories**: Channels (WhatsApp, etc.), Providers (OpenAI, Anthropic, Ollama), Tools.
- **Key Files**: `extensions/`.

## Structural Dependencies
- **Desktop -> CLI**: The Tauri app spawns the `openclaw` CLI to execute tasks (`desktop/src-tauri/src/runs.rs`).
- **Desktop -> Docker**: The Tauri app manages the Gateway container via Docker Compose.
- **CLI -> Gateway**: Agents often communicate through the Gateway for channel access or tool coordination.
- **Gateway -> Extensions**: The Gateway loads extensions to handle specific protocols or APIs.
