# Changelog

## v0.2.1 - 2026-03-04

### Security & UX
- **Address Normalization**: Forced `127.0.0.1` instead of `localhost` in Ollama API base to prevent Windows IPv6 resolution issues.
- **Insecurity Removal**: Removed instructions to set `OLLAMA_ORIGINS="*"`. Frontend-to-backend proxying handles this securely.
- **Address Cleanup**: Removed all `host.docker.internal` references in favor of explicit `127.0.0.1`.

### CI/CD
- **Build Stability**: Set `CARGO_BUILD_JOBS: 1` in Windows build workflow to prevent `Peer disconnected` OOM crashes on GitHub Actions runners.

### Features
- **Live Run Timeline**: Run events stream in real-time via Tauri events — no polling freeze.
- **Inline Diff Viewer**: `PATCH.diff` artifacts render with syntax-colored `+`/`-` lines in the RunDetail view.
- **Run Auto-Start**: Creating a run now immediately starts it and navigates to its detail page.
- **Ollama Test Completion**: `ollama_run_test_completion` command verifies a model works end-to-end after pull.

### Performance
- **AgentsList**: Removed per-agent Docker health check on poll. Interval raised to 8s. Unmount cleanup prevents stale updates.
- **Activity**: Polling now pauses when the tab is not visible (`visibilityState`).

### Fixes
- `EventType` union expanded with `patch.apply.succeeded`, `llm.*`, `approval.resolved`.
- Stale 2s polling loop in RunDetail replaced with event-driven updates.
- `patch.apply.succeeded` now renders correctly in timeline.

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
