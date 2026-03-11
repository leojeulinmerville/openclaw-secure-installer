# Gap Analysis - Technical Audit

## Structural Inconsistencies

1. **Dual Management Layer**:
   - Both the Gateway (`src/gateway`) and the Desktop app (`desktop/src-tauri/src/agents.rs`) have logic for managing "agents" or "nodes".
   - The Gateway has a `node-registry.ts`, while the Desktop app has its own `agents` list in `state.json`.
   - This creates a risk of state desynchronization if an agent is added via the Gateway API directly versus through the Desktop UI.

2. **Run Execution Isolation**:
   - Runs are executed by spawning the `openclaw` CLI as a separate process.
   - While this provides some isolation, it limits the Desktop app's ability to provide real-time, fine-grained control over the agent's internal state (e.g., pausing the LLM turn or mid-turn intervention) without complex IPC.

3. **Policy Enforcement Location**:
   - Governance policies (like the egress allowlist) are partially managed by Docker network settings but lack a central, unified policy engine that works across both CLI-initiated runs and Gateway-initiated interactions.

## Technical Debt Areas

- **Mocked Components**: The `Overview` and `Policies` pages contain significant amounts of mocked data and hardcoded strings. This can lead to a false sense of system capability.
- **Error Handling**: Many Tauri commands return `Result<..., String>`, which often results in loss of structured error information from the underlying CLI or Docker commands.
- **Redundant State**: `InstallerState` in Rust (`state_manager.rs`) and the various context stores in React (`desktop/src/contexts/`) have overlapping responsibilities, leading to multiple "sources of truth" for UI state.

## Limitations for Future Orchestration

1. **No Mission Cycle Controller**:
   - The current architecture is reactive. There is no central "Mission Control" that can orchestrate multiple agents across a longer lifecycle or coordinate complex, multi-step "missions" beyond a single CLI turn.
2. **Capability Registry**:
   - While there's a folder for `extensions/`, there's no dynamic registry that allows the system to introspect its own capabilities (tools, channels, providers) in a structured way that a "Governed Autonomous System" would need.
3. **Evidence & Record Keeping**:
   - The `events.jsonl` system is a good start, but it lacks the formal structure required for a robust "evidence" or "record" system needed for governance and compliance.

## Opportunities for Evolution

| Area | Potential Integration Point |
| :--- | :--- |
| **Mission Control** | A new Tauri module or a separate long-running daemon (`src/daemon`) that coordinates the CLI runs. |
| **Governance Engine** | Centralizing policy definitions in a schema-validated JSON file and enforcing them in the CLI engine's tool-execution loop. |
| **Unified State** | Moving towards a shared SQLite-based state (using `sqlite-vec` already present in `package.json`) instead of multiple JSON files. |
| **Capability Registry** | A structured metadata system for all extensions, exposed via the Gateway's `capabilities-http.ts`. |
