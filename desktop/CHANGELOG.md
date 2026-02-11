# Changelog

## v0.1.8 - 2026-02-11

### Features
- **Real Run Engine**: Implemented end-to-end run execution with real LLM calls (OpenAI/Ollama).
- **Safe Patching**: Added `patch.rs` for safe, confined `git apply` operations on the workspace.
- **Ollama Onboarding**: New wizard for connecting to local Ollama instances.
- **Agents List**: Optimized polling frequency for better performance.

### Fixes
- **Build**: Fixed serialization issues in LLM module.
- **UX**: Improved connectivity checks and error handling.
