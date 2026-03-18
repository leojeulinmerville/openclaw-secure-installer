# Sprint 3 Scope Decision: Truthfulness & Parity

## Context
Sprint 3 transition moves the project from "capability-heavy/UI-incomplete" to "retained-functional/UI-truthful." The goal is a release-ready Windows EXE that respects the existing Gateway platform while providing a reliable Desktop interface.

## Decision: The Truthfulness Mandate
We will not ship a Desktop UI that exposes inoperable or misleading backend paths. The sprint follows an "Audit-Retain-Downgrade" rule for all Desktop-visible surfaces:
1. **Audit:** Verify end-to-end operability from the Desktop configuration flow to actual execution.
2. **Retain:** Functional surfaces remain as direct Desktop affordances.
3. **Downgrade/Hide:** Misleading or broken Desktop paths are hidden or explicitly redirected to the native/original Gateway console path.

## Capability Surface Distinction
Sprint 3 explicitly distinguishes between how capabilities are accessed:
- **Desktop-Direct:** High-polish, no-code configuration flows handled entirely within the Desktop app.
- **Gateway-Native:** Capabilities configured through the original platform/console path but monitored by Desktop.
- **Experimental:** Surfaces that are visible but require manual configuration/intervention.

## Retained Scope Method
The final set of "Desktop-Direct" channels and providers is finalized only after a parity audit. We do not rebuild existing Gateway capabilities; we restore the connectivity between the Desktop and the already functional Gateway/Extension layer.

## Out of Scope
- **Bespoke Desktop Remapping:** We will not manually re-map the entire Gateway capability surface into new Desktop UI forms in this sprint.
- **Universal Storage Centralization:** Operational settings (secrets, gateway configs) remain on their currently supported storage paths unless already centralized in PostgreSQL.
- **Log-Driven Supervision:** Mission Control will NOT use raw stdout/stderr or ephemeral logs as the primary source of truth for mission status.

## Fixed Architectural Constraints
1. **Canonical Mission State:** Local PostgreSQL remains the only canonical source of truth for mission state.
2. **Authority:** The MissionCoordinator is the sole authority for translating significant signals into canonical mission state.
3. **Supervisor:** Rust/Tauri manages the local PostgreSQL process and Gateway container health.
4. **Mission Control:** Must be a projection of state derived from PostgreSQL/Coordinator, not a real-time log viewer.
5. **Operational Storage Boundary:** Gateway configuration, secrets, and other non-mission operational settings remain on their currently supported storage paths unless an existing repo-backed path already centralizes them.
6. **Runtime Topology:** Docker is not required for the canonical mission core. Docker remains part of the supported runtime path for Gateway and execution where relevant.

## Release Relevance
This decision ensures the first public release is "honest"—the user is never presented with a broken Desktop button when a functional Gateway capability exists behind it.
