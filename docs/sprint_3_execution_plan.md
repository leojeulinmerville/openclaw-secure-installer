# Sprint 3 Execution Plan: Mission Control & Release Hardening

## A. Mission Control Truth Boundary Audit
- **Responsibility:** Desktop + Backend Integration.
- **Why:** To ensure the UI reflects the coordinator's canonical mission state, not transient logs.
- **Work:** Audit which Mission Control surfaces already read canonical state or a persisted projection, and which still read raw run files or transient process outputs. Ensure the frontend reads mission state through a stable backend read path backed by the coordinator/canonical projection.
- **Done Condition:** After a mission lifecycle event and an application restart, Mission Control reflects the persisted canonical state without depending on log replay or ad hoc parsing.

## B. Gateway Health Root-Cause and Repair
- **Responsibility:** Tauri Supervisor + Gateway (Docker).
- **Why:** Fix the "Running but Unhealthy" blocker in the Desktop UI.
- **Work:** Systematically diagnose and repair:
  - Wrong health path (e.g., `/` vs `/health`).
  - Route prefix/versioning mismatch.
  - Bind host mismatch (0.0.0.0 in container vs 127.0.0.1 expected).
  - Port mapping mismatch in `docker-compose`.
  - Environment variable/config mismatch.
  - Entrypoint/CMD failure (process alive but app degraded).
  - Startup race (probe sent before Gateway is bound).
  - Auth middleware incorrectly intercepting health probes.
  - Internal application degradation while process is alive.
- **Done Condition:** Desktop UI correctly reports "Healthy" only when the Gateway HTTP probe returns a valid 200 OK response.

## C. Desktop/Gateway Capability Surface Audit
- **Responsibility:** Desktop + Gateway Integration.
- **Why:** Identify the truth about which capabilities are operable from the Desktop.
- **Work:** Audit the existing Gateway extension surface (channels/providers/tools). Map which ones have functional Desktop-direct configuration paths and which must be accessed via the native Gateway console.
- **Done Condition:** A repo-grounded classification of Desktop-Direct, Gateway-Native, and misleading Desktop-claimed capability surfaces is finalized and used to drive UI visibility and routing decisions.

## D. Channel/Provider Operability and Auth/Config Repair
- **Responsibility:** Desktop + Gateway.
- **Why:** Restore functional connectivity for "Desktop-Direct" paths.
- **Work:** Audit the configuration flow, credential flow, and persistence path for Desktop-claimed channels/providers. Fix Desktop-to-Gateway mismatches that prevent successful credential passing or runtime validation.
- **Done Condition:** At least one channel and one provider path are verified as fully functional through the direct Desktop UI flow.

## E. UI Parity Cleanup and Truthful Routing
- **Responsibility:** Desktop.
- **Why:** Ensure the UX is truthful and avoids dead-ends.
- **Work:** Hide or downgrade misleading Desktop affordances identified in the audit. Implement explicit routing or labeling for "Gateway-Native" capabilities.
- **Done Condition:** No buttons or forms exist in the standard Desktop path that trigger broken or unconfigured backend code.

## F. Packaging and Startup Non-Regression Validation
- **Responsibility:** Tauri Build Pipeline.
- **Why:** Ensure the `.exe` distribution preserves the zero-config architecture.
- **Work:** Validate that the packaged application successfully bootstraps the local PostgreSQL instance on a clean Windows environment. Validate Gateway health/operability on a supported Windows setup with the Docker runtime available.
- **Done Condition:** The generated `.exe` installer successfully bootstraps local PostgreSQL and preserves Mission Control operability on first run. Gateway health and operability are validated on a supported Windows setup with the expected Docker runtime available.

## 6. Strict Exit Criteria

1. **Gateway Health**  
   The Desktop health probe returns the expected healthy response from the Gateway runtime, and the UI reflects that result truthfully.

2. **Mission Fidelity**  
   Mission Control reads mission state through a stable backend path backed by canonical mission state or a persisted projection derived from it.

3. **Audited Parity**  
   Every Desktop-Direct channel and provider kept visible in the default Desktop path is verified as operable through the normal supported configuration, validation, and mission/run flow.

4. **UI Truthfulness**  
   Misleading Desktop-claimed surfaces are hidden, downgraded, labeled experimental/manual, or explicitly routed to the native Gateway console path.

5. **Packaging Non-Regression**  
   The packaged Windows `.exe` successfully bootstraps PostgreSQL and preserves Mission Control operability on a fresh supported test machine.

6. **Supported Gateway Validation**  
   Gateway health and operability are validated on a supported Windows environment with the expected Docker runtime available.

## 7. Top Execution Backlog

1. **Identify:** Determine the exact Desktop health probe target URL and expected response.
2. **Audit:** Identify Mission Control UI surfaces still depending on raw logs or run files instead of canonical state.
3. **Verify:** Establish a stable backend read path for canonical mission state for the frontend.
4. **Diagnose:** Test Gateway health against the 9 root-cause classes (path, prefix, bind, port, env, entrypoint, race, auth, degradation).
5. **Audit:** Map the existing Gateway extension surface to "Desktop-Direct" vs "Gateway-Native" access modes.
6. **Repair:** Fix the configuration-to-consumption flow for the primary Desktop-direct channel (e.g., WhatsApp).
7. **Repair:** Fix the discovery-to-consumption flow for the primary Desktop-direct provider (e.g., Ollama).
8. **UI:** Implement visibility filters to hide broken/unconfigured Desktop affordances.
9. **UI:** Add truthful Gateway "Healthy" status badge and native console routing labels.
10. **Hardening:** Ensure Tauri supervisor handles PostgreSQL connection retries during zero-config bootstrap.
11. **Validation:** Verify packaged Windows startup for PostgreSQL bootstrap non-regression.
12. **Validation:** Confirm Gateway operability on supported Windows environment with Docker runtime available.
