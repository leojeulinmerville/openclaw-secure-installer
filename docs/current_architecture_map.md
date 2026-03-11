# Current Architecture Map

## Execution Architecture

### Core Engine
The core execution engine is the `openclaw` CLI, which is built on the `pi-agent-core` and `pi-ai` packages.
- **Run Execution**: When a "Run" is started in the Desktop app, it spawns a background process that calls the CLI with specific arguments.
- **Tool Execution**: Tool calls are handled by the CLI. The Desktop app has a `patch.rs` module that specifically handles file patches (diffs) generated during runs.
- **Process Spawning**: Tauri uses its `async_runtime::spawn` to run these background commands (`desktop/src-tauri/src/runs.rs`).

### Gateway Management
The Gateway is not just a sub-module; it's a separate runtime environment (typically Dockerized).
- **Deployment Strategy**: Managed via Docker Compose (`gateway::start_gateway`).
- **Communication**: The Desktop app communicates with the Gateway over HTTP (usually port 8080).
- **Health Checks**: The app performs health checks (`gateway::check_gateway_health`) to ensure the gateway container is stable before allowing interaction.

### LLM Provider Management
LLM providers are abstracted through the `src/providers` and `extensions/` system.
- **Active Providers**: OpenAI, Anthropic, Ollama, LM Studio (from `desktop/src-tauri/src/chat.rs`).
- **Discovery**: The Desktop app can discover available models from local providers like Ollama or LM Studio.

## Storage and Points of Truth

| Entity | Storage Type | Location (Relative to App Data) | Point of Truth |
| :--- | :--- | :--- | :--- |
| **System State** | JSON | `state.json` | Global settings, agents list, install status. |
| **Agent Runs** | File System (Folder) | `runs/{run_id}/` | Execution status, logs, artifacts. |
| **Run Metadata** | JSON | `runs/{run_id}/meta.json` | Specific run settings (agent, model, provider). |
| **Run Events** | JSONL | `runs/{run_id}/events.jsonl` | Sequential audit log of the run. |
| **Gateway Config** | `.env` | (Managed by Desktop app) | Gateway port, token, bind host. |
| **Secrets** | Keyring / Keychain | (System OS Vault) | API Keys, Gateway Tokens. |

## Orchestration Logic
- **Primary Orchestrator**: The Desktop App (`desktop/src-tauri/src/main.rs`). It is the central authority that coordinates between the user, the Gateway, and the CLI.
- **Run Flow**:
  1. User creates a Run in the UI.
  2. UI calls `create_run` (Tauri command).
  3. User starts the Run.
  4. UI calls `start_run` (Tauri command), which spawns `openclaw` CLI.
  5. CLI executes and appends events to `events.jsonl`.
  6. UI polls or listens for events (via `emit`) to update the dashboard.
