# Vertical Slice Execution Plan

> **Type**: Internal execution document.
> **Date**: 2026-03-22
> **Repo**: `openclaw-secure-installer`, branch `main`.
> **Constraint**: Solo builder. No team. No timeline fantasy.
> **Governing document**: `docs/strategic_reset_and_wedge_plan.md`

---

## 1. Execution Objective

Prove, in a working desktop application on Windows, that a mission can be created, linked to a contract, executed via the OpenClaw CLI, and that the resulting canonical state in PostgreSQL survives a full application restart with all mission-related data intact and readable in the MissionDetail UI — without manual hacks, forced refreshes outside the normal event path, or data loss.

This is not a feature sprint. This is a proof sprint. The implementation delta is small because most infrastructure exists. The work is hardening, correctness, and consolidation — not greenfield construction.

---

## 2. Product Claim Being Proven

> Local AI agent work is persistent and recoverable. When you create a mission, execute a linked run, and close the application, your mission state — contracts, validation records, discovered artifacts, resume snapshots, and state projection — is fully preserved in a local PostgreSQL database and rehydrated on next launch. No cloud dependency. No state loss.

This claim is narrow. It does not extend to multi-agent orchestration, governed branching, evidence systems, policy enforcement, or any capability described in the V2 constitution that does not yet exist in code.

---

## 3. Repo-Grounded Starting Truth

### What exists and works

| Component | File(s) | Status |
|:---|:---|:---|
| **Execution substrate** | OpenClaw CLI, spawned from `runs.rs` via `tokio::process::Command` | Functional. Spawns child process, streams stdout/stderr, parses `[OC_EVENT]` prefixes for 3 event names |
| **Embedded PG runtime** | `runtime_pgsql.rs` (11KB) | Functional. Extracts bundled PG, runs `initdb`, starts `pg_ctl`, manages lifecycle, health checks |
| **Mission schema** | 4 SQL migrations (init_core, sprint_1_core, sprint_1_completion, sprint_2_bridge) | Functional. Creates 11 tables: missions, mission_charters, case_files, contracts, artifacts, decision_records, validation_records, resume_snapshots, mission_state_projections, responsibility_ledger_entries, run_linkages |
| **Repositories** | 12 files in `repositories/` | Functional. CRUD for all canonical tables |
| **Services** | 6 files in `services/` (mission, contract, projection, records, resume + mod) | Functional. Thin wrappers over repositories |
| **Mission Coordinator** | `mission_coordinator.rs` (122 lines) | Functional as CRUD pass-through. Creates missions (with charter + case file + projection), admits contracts, records decisions/validations, delegates to services |
| **Tauri commands** | `mission_commands.rs` (231 lines, 15 commands) | Functional. All commands registered in `main.rs`. Covers create/list/get missions, pause/resume/refresh, admit contract, record decision/validation, create artifact, start_contract_activation, list contracts/artifacts/linkages/decisions/validations, add intervention |
| **Partial bridge** | `reconcile_run_status_core` in `runs.rs` (lines 504-602) | Functional. Writes run_linkages status, updates contract status, writes validation records (with idempotence check), creates resume snapshots, refreshes projections. Also handles blocked-state decision records |
| **Run linkage on creation** | `create_run` in `runs.rs` (lines 112-120) | Functional. Writes `run_linkages` record when `mission_id` and `contract_id` are provided |
| **Artifact discovery** | `discover_artifacts` in `runs.rs` (lines 316-368) | Functional. Walks workspace directory, upserts artifacts into PG per mission/contract |
| **MissionDetail UI** | `MissionDetail.tsx` (559 lines) | Functional. Renders: mission header, live state projection (12 fields), contracts panel with "Launch Linked Run" buttons, linked runs panel, artifacts panel, decision feed, validation feed. Listens on `mission-projection-updated` Tauri event for real-time refresh |
| **Missions list UI** | `Missions.tsx` (8.6KB) | Functional. Lists missions, creates missions |
| **CreateRun UI** | `CreateRun.tsx` (8.4KB) | Functional. Accepts mission_id/contract_id from navigation, creates and starts linked runs |
| **Real-time event path** | `runs.rs` emits `mission-projection-updated` → MissionDetail listens → reloads all data | Functional. The reactive refresh loop exists |

### What is partial

| Component | Current state | Gap |
|:---|:---|:---|
| **Reconciliation location** | Lives entirely in `runs.rs::reconcile_run_status_core` | Bypasses MissionCoordinator. The coordinator is not on the reconciliation path. Creates an authority split. |
| **Contract status transitions** | Mechanical: running→active, done→fulfilled, failed→failed, blocked→blocked | No guard against illegal transitions (e.g., fulfilled→active). No transition validation. |
| **CLI event vocabulary** | 3 events parsed: `run.started`, `run.completed`, `run.failed` | No mid-execution events. No tool-call signals. No artifact-creation events from the CLI itself. |
| **Projection accuracy** | `refresh_projection` reads mission + active contract count + last decision + last validation | Does not reflect run linkage statuses, does not compute resume readiness dynamically, `needs_human_attention` is hardcoded `false` |
| **Resume mechanism** | Snapshots are written at run end. `resume_readiness` field exists on missions. | Nothing reads snapshots to determine actual resume readiness. No resume-from-snapshot action exists. |
| **Mission status updates** | Mission status only changes via explicit pause/resume from UI | No automatic mission status update based on aggregate contract/run states (e.g., all contracts fulfilled → mission completed) |

### What is still mocked or out of scope

- Cost tracking: `formatCost(0)`, no real tracking
- Alerts: `MOCK_ALERTS`
- Security policies: static UI display
- Governance state: schema fields exist, never set dynamically
- Mission modes: field exists, always `autonomous`
- Evidence bundles, claims, committees, branching, recovery taxonomy, capability registry: none exist
- Gateway: 308-line Node.js placeholder with in-memory stores

---

## 4. What This Slice Is and Is Not

### In scope

- Proving the end-to-end data flow: create mission → admit contract → launch linked run → reconcile terminal state → persist canonical data → UI reads canonical data → app restart preserves everything
- Hardening idempotence in reconciliation (duplicate terminal events must not corrupt state)
- Hardening contract status transition legality
- Ensuring projection refresh is automatically triggered after every canonical write and accurately reflects current state
- Verifying restart safety: embedded PG survives app close/reopen, all canonical tables readable
- Confirming the MissionDetail UI displays real, non-empty data for all bridge panels after a completed run
- Documenting and testing the exact truth table for all run terminal states

### Out of scope — do not touch

- **New UI pages.** The 18 existing React pages are sufficient. Do not create new pages.
- **Dashboard expansion.** Do not add new panels, widgets, or visualization features to MissionDetail or any other page.
- **Governance engine.** Do not implement dynamic governance state, policy enforcement, or OPA integration.
- **Evidence system.** Do not build evidence bundles, claims, or counter-evidence structures.
- **Branching.** Do not implement concurrent trajectories or branching models.
- **Multi-agent orchestration.** Do not modify the CLI agent loop or add multi-process coordination.
- **Coordinator elevation to orchestration authority.** Do not make the coordinator decide when to launch runs, which model to use, or how to interpret results. That is post-proof work.
- **V2 constitution features.** Do not implement institutional hierarchies, committee logic, capital opératoire, transition governance, or mission modes.
- **Gateway evolution.** Do not modify `gateway/openclaw.mjs` beyond its current minimal state.
- **Channel routing or extension exposure.** Not relevant to this slice.
- **Cost tracking, alerts, or policy UI.** Leave mocked.

---

## 5. The Exact End-to-End Slice

### User flow

1. User opens the desktop app. PG bootstraps automatically.
2. User navigates to **Missions** page. Clicks **Create Mission**.
3. User enters a title (e.g. "Implement login page") and an intent string. Clicks **Create**.
4. Mission appears in the list with status `active`.
5. User clicks into the mission. **MissionDetail** page loads.
6. User clicks **Admit Contract** (or equivalent action). Enters contract type `execution`, title "Build login form".
7. Contract appears in the **Active Contracts** panel with status `pending`.
8. User clicks **Launch Linked Run** on the contract.
9. **CreateRun** page opens, pre-filled with `mission_id` and `contract_id`.
10. User selects provider, model, workspace. Clicks **Start Run**.
11. Run is created. Linkage record is written to PG. Run starts executing.
12. Contract status transitions to `active` in real-time via reconciliation.
13. Run completes (success or failure).
14. MissionDetail updates automatically via `mission-projection-updated` event:
    - Contract status → `fulfilled` (success) or `failed` (failure)
    - Validation record appears in Validation Feed
    - Discovered artifacts appear in Artifacts panel
    - Projection updates: active contract count, last validation summary
15. User closes the app entirely (window close, process kill).
16. User reopens the app. PG restarts.
17. User navigates to Missions → same mission is listed.
18. User opens MissionDetail → all data is intact: contracts, validation records, artifacts, linked runs, projection.

### System flow

```
User action: Create Mission
    → invoke('create_mission', {title, intent})
    → MissionCoordinator::create_mission()
    → MissionService::create_mission()
        → missions table INSERT
        → mission_charters table INSERT
        → case_files table INSERT
        → mission_state_projections table INSERT (initial)
    → Return Mission object to UI

User action: Admit Contract
    → invoke('admit_contract', {missionId, contractType, title})
    → MissionCoordinator::admit_contract()
    → ContractService::admit_contract()
        → contracts table INSERT (status: 'pending')
    → ProjectionService::refresh_projection()
    → Return Contract object to UI

User action: Launch Linked Run
    → Navigate to CreateRun with mission_id + contract_id
    → invoke('create_run', {agentId, provider, model, title, userGoal, workspacePath, missionId, contractId})
    → create_run() in runs.rs
        → Run meta.json written to filesystem
        → run_linkages table INSERT (status: 'queued')
    → invoke('start_run', {runId})
    → start_run() → spawns background task → real_run_execution()

Background: Run executes
    → CLI child process spawned
    → stdout lines streamed, [OC_EVENT] parsed
    → Events appended to events.jsonl

Background: Run reaches terminal state
    → update_run_status() called
    → reconcile_run_status() called
    → reconcile_run_status_core():
        run_linkages.status UPDATE
        contracts.status UPDATE (pending→active→fulfilled/failed)
        validation_records INSERT (idempotent check)
        resume_snapshots INSERT
        ProjectionService::refresh_projection()
    → discover_artifacts() (on success)
        artifacts table UPSERT
    → Emit 'mission-projection-updated' event

Frontend: MissionDetail receives event
    → Listener triggers loadMission() + loadProjection() + loadLinkedData()
    → All panels re-render with fresh PG data

App restart:
    → runtime_pgsql.rs restarts PG (data directory preserved)
    → SQLx pool reconnects
    → User navigates to MissionDetail
    → All invoke() calls fetch from PG
    → All data intact
```

---

## 6. Required Backend Truth Path

### Where truth starts

Truth originates at the boundary between the OpenClaw CLI child process and `runs.rs`. Specifically:

1. **Process exit code**: success (0) or failure (non-zero) determines the primary terminal state.
2. **`[OC_EVENT]` prefixed stdout lines**: parsed for `run.started`, `run.completed`, `run.failed` events.
3. **Workspace filesystem**: workspace directory contents are scanned for artifact discovery.

These are the only truth signals available from the CLI. The event vocabulary is thin — there are no structured mid-execution signals, no tool-call events, and no agent-reasoning events.

### Where truth is interpreted

`reconcile_run_status_core()` in `runs.rs` (lines 504-602) is the interpretation layer. It maps:

| CLI signal | Canonical effect |
|:---|:---|
| RunStatus::Running | run_linkages → running, contract → active |
| RunStatus::Done | run_linkages → done, contract → fulfilled, validation record (pass), resume snapshot |
| RunStatus::Failed | run_linkages → failed, contract → failed, validation record (fail), resume snapshot |
| RunStatus::Blocked | run_linkages → blocked, contract → blocked, decision record (run_blocked), resume snapshot |
| RunStatus::Cancelled | run_linkages → cancelled, contract → failed, validation record (fail) |
| workspace scan | artifacts table UPSERT (on success path only) |

### Where truth is persisted

PostgreSQL, via SQLx repositories. All canonical writes happen inside `reconcile_run_status_core()` and `discover_artifacts()`.

### Where truth is projected for UI

`ProjectionService::refresh_projection()` reads from missions, contracts, decision_records, and validation_records tables, computes an aggregate `MissionStateProjection`, and upserts it. MissionDetail reads the projection via `get_mission_projection` and all linked data via list commands.

### Position on reconciliation location

**Reconciliation should remain in `runs.rs` for this slice.**

Rationale:

1. Moving reconciliation into the coordinator requires refactoring the async event flow — the coordinator is currently instantiated per-request (not a long-lived singleton), cannot receive background notifications, and has no event subscription mechanism. Adding this infrastructure is out of scope for a proof sprint.

2. The reconciliation logic in `runs.rs` is already wired and tested through Sprint 7. Disrupting it introduces regression risk for zero proof value.

3. The coordinator's role in this slice is front-door CRUD: creating missions, admitting contracts, recording manual decisions, launching runs through `start_contract_activation`. The back-door reconciliation (CLI events → canonical state) living in `runs.rs` is architecturally imperfect but functionally correct for the proof.

4. The coordinator should not pretend to be an orchestration authority when it is not. Keeping reconciliation in `runs.rs` is honest. Moving it into a CRUD wrapper and calling it "coordinator authority" would be cosmetic, not structural.

**Post-proof**: If mission continuity is validated and the wedge is defensible, then elevating the coordinator to a genuine orchestration authority (event-driven, with decision logic) becomes the next architectural investment. Not now.

---

## 7. File-by-File Implementation Plan

### 7.1 `desktop/src-tauri/src/runs.rs` (758 lines)

**Why it must be reviewed and possibly changed**:
This file contains the entire bridge. It is already wired. The question is whether it is correct enough for the proof.

**What must be verified / hardened**:

- **Contract status transition guards**: `update_status()` in `contracts_repository.rs` performs a blind `UPDATE SET status = $1`. There is no check for illegal transitions (e.g., `fulfilled → active`). For the proof, add a transition validation check inside `reconcile_run_status_core()` before calling `contracts_repo.update_status()`. Legal transitions: `pending → active`, `active → fulfilled`, `active → failed`, `active → blocked`, `pending → failed` (if run fails before starting). Reject any other transition silently (log warning, do not corrupt state).

- **Idempotence of validation record creation**: Already implemented (lines 556-578). Check: scan existing validation records for this run_id. If found, skip. Verify this logic handles the case where `evidence_links` is `None` or malformed.

- **Idempotence of resume snapshot creation**: Not currently guarded. `reconcile_run_status_core()` always creates a snapshot on terminal states. If called twice with the same terminal status, it will create duplicate snapshots. Add an idempotence check: query existing snapshots for this run_id in `state_blob`, skip if already present.

- **Artifact discovery on failure path**: Currently, `discover_artifacts()` only runs on the success path (line 461). For the proof, this is acceptable — failed runs may not produce useful artifacts. Leave as-is.

- **`mission-projection-updated` event payload**: Currently emits `mission_id` as the payload (line 608). MissionDetail listener checks `event.payload === missionId` (line 34 of MissionDetail.tsx). Verify the serialization format matches — the Rust side emits a `Uuid`, the JS side compares a string. This may require `mission_id.to_string()` on the Rust side if not already handled by Tauri's serialization.

**What must remain untouched**:
- CLI spawning logic (lines 370-471). Do not modify how the CLI is invoked.
- Event streaming / `[OC_EVENT]` parsing (lines 254-314). Do not change the event vocabulary.
- `_append_event`, `_update_run_meta`, `get_runs_dir` helpers. Stable utility code.
- `submit_approval` logic (lines 622-680). Works. Not part of the primary proof path but not harmful.

**Risk**: The biggest risk in this file is the event payload format mismatch between Rust `Uuid` and JS string comparison. If the listener never fires, the UI will appear stale despite correct backend writes. This must be tested explicitly.

---

### 7.2 `desktop/src-tauri/src/mission_coordinator.rs` (122 lines)

**Why it might change**: 
If `start_contract_activation` needs to update the contract status to `active` before launching the run (anticipatory status update), this would be added here.

**Current behavior**: `start_contract_activation` creates a run request with `mission_id` and `contract_id`, calls `create_run()` and `start_run()`. The contract status transition to `active` happens later, inside `reconcile_run_status_core()` when `RunStatus::Running` is observed.

**Decision for the proof**: Leave as-is. The reconciliation path handles the contract status transition. Anticipatory updates in the coordinator would create a double-write risk and complicate idempotence. The UI already shows contract status `pending` until the run reports `Running`, which is correct behavior.

**What must remain untouched**: Every existing method. The coordinator's CRUD pass-through behavior is stable.

**Risk**: Low. This file is a thin façade.

---

### 7.3 `desktop/src-tauri/src/services/projection_service.rs` (70 lines)

**Why it might change**:
The projection currently does not reflect whether a mission should be considered `completed` based on aggregate contract states, and `needs_human_attention` is hardcoded `false`.

**What should change for the proof**:

- **`needs_human_attention`**: If any linked contract is in `blocked` status, set `needs_human_attention = true`. This requires querying contracts for blocked status inside `refresh_projection()`. Adds roughly 5 lines.

- **Resume readiness**: If at least one resume snapshot exists for this mission, set `resume_readiness = true` in the projection. Currently `resume_readiness` is read from the mission row, where it is always `false` unless manually set. For the proof, compute it: `SELECT EXISTS(SELECT 1 FROM resume_snapshots WHERE mission_id = $1)`.

**What must remain untouched**: The overall upsert structure. Do not add new projection fields or change the table schema.

**Risk**: Low. The changes are two additional queries in an already-query-heavy function.

---

### 7.4 `desktop/src-tauri/src/services/mission_service.rs` (75 lines)

**No changes needed for the proof.**

`create_mission` already creates mission + charter + case_file + initial projection. `pause_mission` and `resume_mission` update status and refresh projection. This is all correct.

---

### 7.5 `desktop/src-tauri/src/services/contract_service.rs` (25 lines)

**No changes needed for the proof.**

`admit_contract` delegates to `ContractsRepository::create`. Contract status updates happen through reconciliation, not through this service.

---

### 7.6 `desktop/src-tauri/src/repositories/contracts_repository.rs` (100 lines)

**Why it might change**:
Status transition validation. Currently `update_status()` is a blind UPDATE. For the proof, either:
- (a) Add a `get()` call before `update_status()` in `reconcile_run_status_core()` to check current status before writing, or
- (b) Add a SQL `WHERE status IN (legal_previous_statuses)` clause to the UPDATE query.

Option (a) is preferred because it keeps the repository generic and puts the business logic where it belongs (in the reconciliation function).

**Risk**: Very low. The change is defensive validation, not behavior modification.

---

### 7.7 `desktop/src-tauri/src/repositories/resume_snapshots_repository.rs`

**Why it might change**: 
Need a query method to check if a snapshot already exists for a given `run_id` (via `state_blob` JSON field). This enables idempotence in snapshot creation.

**What to add**: A method like `exists_for_run_id(mission_id, run_id) -> Result<bool, String>` that queries `SELECT EXISTS(SELECT 1 FROM resume_snapshots WHERE mission_id = $1 AND state_blob->>'run_id' = $2)`.

Also needed: a method `exists_for_mission(mission_id) -> Result<bool, String>` for the projection service to compute `resume_readiness`.

**Risk**: Low. Additive query methods on an existing repository.

---

### 7.8 `desktop/src-tauri/src/mission_commands.rs` (231 lines)

**No changes needed for the proof.**

All 15 Tauri commands are registered and functional. The UI already invokes them. The data flows correctly.

---

### 7.9 `desktop/src-tauri/src/main.rs`

**Verify only**: Ensure all mission commands and run commands are registered in the `tauri::Builder` invocation handler list. Based on prior analysis, they are. No changes expected.

---

### 7.10 `desktop/src/pages/MissionDetail.tsx` (559 lines)

**Why it might need verification (not necessarily changes)**:

The page already renders all required panels. The key verification points are:

- **Does `mission-projection-updated` event listener fire correctly?** The listener at line 33 compares `event.payload === missionId`. If the Rust side emits a `Uuid` and Tauri serializes it as a JSON string (with quotes), the comparison may or may not match depending on whether `missionId` in the React component is the bare UUID string or includes surrounding quotes. This must be tested.

- **Does `listMissionContracts` return contracts with updated statuses?** Yes — it queries `SELECT * FROM contracts WHERE mission_id = $1`, which returns current PG state. No caching issue.

- **Does the validation feed render correctly?** The rendering at line 534 uses `v.is_passing` as a boolean and `v.validation_type` as a string. Verify these field names match the actual `ValidationRecord` type returned by the backend. The repository returns `outcome` (string: "pass" or "fail"), not `is_passing` (boolean). If the TypeScript type definition has `is_passing` but the backend sends `outcome`, there is a field mapping bug. **This is a likely bug that must be investigated and fixed.**

- **Does the validation feed render `v.summary`?** Yes, at line 537. The backend sends `summary` as `Option<String>`. If null, nothing renders. Acceptable.

**Probable change needed**: The `ValidationRecord` TypeScript type likely needs to match the backend's serialization. If the backend sends `{ outcome: "pass", summary: "...", validation_scope: "run_completion" }` but the frontend expects `{ is_passing: true, validation_type: "...", summary: "..." }`, there is a mapping mismatch. Fix by either:
- (a) Adding a computed `is_passing` field in the backend serialization, or
- (b) Fixing the frontend to derive `is_passing` from `outcome === "pass"`.

Option (b) is preferred — less backend churn, keeps the frontend as the presentation layer.

**What must remain untouched**: All panel layout, styling, and interaction patterns. The UI is already built. Do not redesign.

**Risk**: Medium. The type mismatch between backend and frontend for validation records is a likely source of rendering bugs. Must be verified.

---

### 7.11 `desktop/src/pages/Missions.tsx` (8.6KB)

**Verify only**: Ensure mission creation UI sends `title` and `intent` to `create_mission` command. No changes expected.

---

### 7.12 `desktop/src/pages/CreateRun.tsx` (8.4KB)

**Verify only**: Ensure navigation from MissionDetail passes `mission_id` and `contract_id`, and that CreateRun reads and forwards them to `create_run`. Based on MissionDetail line 406, navigation passes `{ name: 'create-run', mission_id: missionId, contract_id: c.contract_id }`. Verify CreateRun reads these from navigation state.

---

### 7.13 `desktop/src/types.ts`

**Verify**: Check `ValidationRecord` type definition. If it uses `is_passing: boolean` and `validation_type: string`, but the backend sends `outcome: string` and `validation_scope: string`, fix the type to match the backend. This is the most likely frontend/backend contract bug.

**Also verify**: `RunLinkage` type matches the backend `RunLinkage` struct from `run_linkages_repository.rs`.

---

### 7.14 `desktop/src-tauri/src/runtime_pgsql.rs` (11KB)

**No changes needed.**

The PG runtime handles full lifecycle: extract, initdb, start, health check, shutdown. Data directory is persistent in the app data directory. On app restart, PG re-starts from the existing data directory. This is the foundation of restart safety.

**Verify only**: Confirm the data directory path is deterministic and not inside a temp directory that gets cleaned.

---

### 7.15 `desktop/src-tauri/src/db.rs`

**No changes needed.**

Contains `DbState` with the `PgPool`. Used by all Tauri commands via `State<'_, DbState>`.

---

## 8. Canonical Data Responsibilities

### Mandatory tables (must receive real data during the slice)

| Table | Purpose in this slice | Written by |
|:---|:---|:---|
| `missions` | Mission header: title, status, health, governance, mode, phase | `MissionService::create_mission`, `pause_mission`, `resume_mission` |
| `mission_charters` | Intent record for the mission | `MissionService::create_mission` |
| `case_files` | Initial case file summary | `MissionService::create_mission` |
| `contracts` | Execution contract linked to mission | `ContractService::admit_contract`, `reconcile_run_status_core` (status updates) |
| `run_linkages` | Run ↔ Mission/Contract link | `create_run` (creation), `reconcile_run_status_core` (status updates) |
| `validation_records` | Terminal run validation outcome | `reconcile_run_status_core` |
| `artifacts` | Discovered workspace files | `discover_artifacts` |
| `resume_snapshots` | Post-run resume data | `reconcile_run_status_core` |
| `mission_state_projections` | Aggregated mission state for UI | `MissionService::create_mission` (initial), `ProjectionService::refresh_projection` (updates) |

### Optional tables (may receive data depending on flow)

| Table | When written |
|:---|:---|
| `decision_records` | On blocked runs, on approval resolution, on operator intervention |
| `responsibility_ledger_entries` | On approval resolution events |

### Tables that must NOT be expanded

All existing tables are sufficient for this slice. Do not:
- Add new columns to any table
- Create new tables
- Modify migration files
- Add JSONB fields to existing tables

The schema is stable. The proof must work within the existing schema.

---

## 9. Truth Table and Reconciliation Rules

### Run outcome matrix

| CLI outcome | RunStatus | run_linkages.status | contracts.status | validation_records | resume_snapshots | artifacts | projection_refresh |
|:---|:---|:---|:---|:---|:---|:---|:---|
| Process starts | Running | running | pending → active | — | — | — | Yes |
| Process exits 0 | Done | done | active → fulfilled | INSERT (outcome=pass) | INSERT | Workspace scan + UPSERT | Yes |
| Process exits non-0 | Failed | failed | active → failed | INSERT (outcome=fail) | INSERT | No scan | Yes |
| Process killed by user | Cancelled | cancelled | active → failed | INSERT (outcome=fail) | — | No scan | Yes |
| Approval blocked | Blocked | blocked | active → blocked | — | INSERT | — | Yes |
| Approval rejected | Failed | failed | blocked → failed | INSERT (outcome=fail) | INSERT | No scan | Yes |
| CLI emits `run.started` | Running | (same as above) | — | — | — | — | — |
| CLI emits `run.completed` | Done | (same as above) | — | — | — | — | — |
| CLI emits `run.failed` | Failed | (same as above) | — | — | — | — | — |

### Contract status transition legality

| From | Allowed to |
|:---|:---|
| pending | active, failed |
| active | fulfilled, failed, blocked |
| blocked | failed |
| fulfilled | (terminal, no further transitions) |
| failed | (terminal, no further transitions) |

Any transition not in this table must be silently rejected with a log warning. Specifically guard against: `fulfilled → active`, `failed → active`, `fulfilled → failed`, double-terminal writes.

### Projection refresh trigger

Projection refresh must happen after every canonical write that affects contracts, validation records, or decision records. Currently triggered at the end of `reconcile_run_status_core()`. This is correct. Do not add additional refresh triggers.

---

## 10. Idempotence and Restart Safety Requirements

### Duplicate terminal event handling

If `reconcile_run_status_core()` is called twice with the same `(run_id, status)`:

1. **run_linkages**: Already guarded (line 517: `if linkage.status == status_str { return }`). No duplicate write.
2. **contracts**: Must be guarded by transition legality. If contract is already `fulfilled` and reconciliation tries `fulfilled → fulfilled`, it must be a no-op.
3. **validation_records**: Already guarded (lines 556-578: checks existing records for `run_id` in `evidence_links`). No duplicate insert.
4. **resume_snapshots**: NOT currently guarded. **Must add idempotence check**: query for existing snapshot with matching `run_id` in `state_blob`. If exists, skip.
5. **artifacts**: Repository uses `upsert_artifact()`, which is inherently idempotent for the same `(mission_id, name, storage_path)` tuple. Verify this is actually an UPSERT (ON CONFLICT) and not just INSERT.
6. **projection refresh**: Refreshing is always safe — it reads current state and upserts. Multiple refreshes produce the same result.

### Restart safety

1. **PostgreSQL data persistence**: Embedded PG stores data in the app data directory (`~/.openclaw-secure-installer/` or equivalent). This is NOT a temp directory. Data survives process death.
2. **PG startup on app relaunch**: `runtime_pgsql.rs` detects existing data directory, skips `initdb`, runs `pg_ctl start`. Pool reconnects. All tables intact.
3. **No in-memory-only state for canonical data**: All canonical mission state is in PG. Run metadata is in filesystem `meta.json`. Both survive restart.
4. **UI data loading**: MissionDetail calls `invoke()` on mount, which queries PG. No dependency on in-memory caches from prior session.

### Restart test specification

1. Create mission + contract + run. Wait for terminal state.
2. Verify all panels populated in MissionDetail.
3. Close the app (task manager kill or normal close).
4. Reopen the app. Wait for PG to start (health check in startup sequence).
5. Navigate to same mission.
6. All panels must show identical data to step 2.

If any data is missing after restart, the slice fails.

---

## 11. UI Proof Requirements

### What the user must see in MissionDetail after a successful linked run

| Panel | Must show | Acceptable if absent |
|:---|:---|:---|
| **Mission header** | Title, status `active`, health `stable`, governance `normal`, mode `autonomous` | Phase may be `N/A` |
| **Live State Projection** | Active contract count (0 after fulfillment), last validation summary (non-empty), resume readiness (true) | Focus, blocker risk may be empty |
| **Active Contracts** | At least 1 contract with status `fulfilled` | — |
| **Linked Runs** | At least 1 run with status `done` | — |
| **Discovered Artifacts** | At least 1 artifact with name and path | Empty is acceptable if workspace had no files (test with a workspace that has files) |
| **Decision Feed** | Empty is acceptable for success path | Will contain entries on blocked/intervention paths |
| **Validation Feed** | At least 1 validation with outcome pass/fail | — |

### What must NOT be required

- Manual "Refresh" button click to see updated data. The `mission-projection-updated` event must trigger automatic reload.
- Navigation away and back to see updates. Real-time listener must work.
- Browser developer console open. The app must work without debugging tools.

### What may remain broken without failing the slice

- Cost tracking showing $0.00
- Alerts panel showing mock data
- Policies page showing static content
- Overview page showing stale or partial data

These are known mocks outside the slice scope.

---

## 12. Acceptance Criteria

The proof is complete if and only if ALL of the following are true:

1. A mission is created via the Missions UI with a title and intent. The mission appears in the list and is accessible in MissionDetail.

2. A contract is admitted via MissionDetail. The contract appears in the Active Contracts panel with status `pending`.

3. A linked run is launched from the contract's "Launch Linked Run" button. The CreateRun page opens with pre-filled `mission_id` and `contract_id`. The run starts.

4. During execution, the contract status transitions to `active` and is visible in MissionDetail without manual refresh.

5. On run completion (success), the following are visible in MissionDetail without manual refresh:
   - Contract status is `fulfilled`
   - Linked Runs panel shows run with status `done`
   - Validation Feed shows a validation record with outcome indicating pass
   - Discovered Artifacts panel shows at least one artifact (if workspace had files)
   - Live State Projection shows updated `last_validation_summary`

6. On run failure, the following are visible:
   - Contract status is `failed`
   - Linked Runs panel shows run with status `failed`
   - Validation Feed shows a validation record with outcome indicating fail

7. After closing and reopening the app, navigating to the same mission shows all data from criteria 5 or 6 intact.

8. Running the same linked run scenario twice does not create duplicate validation records, duplicate resume snapshots, or illegal contract status transitions.

9. No new UI pages, panels, or components were needed to demonstrate these criteria.

10. The proof can be reproduced on a fresh Windows machine with the desktop app built from source, without requiring manual database manipulation, API calls outside the UI, or configuration beyond what the app provides.

---

## 13. Validation and Demo Protocol

### Setup

1. Build the desktop app: `cd desktop && pnpm build` then `cargo build --manifest-path src-tauri/Cargo.toml` (or `cargo tauri dev` for dev mode).
2. Ensure Docker is running (for gateway container if needed) or verify the app can operate without the gateway for mission-only flows.
3. Ensure an LLM provider is configured (Ollama running locally, or an API key for OpenAI/Anthropic).
4. Prepare a workspace directory with at least 2-3 files (e.g., a simple project with `README.md`, `index.html`, `style.css`).

### Action sequence — Success path

1. Open app. Wait for PG health check to pass (visible in startup or console).
2. Navigate to Missions. Click Create Mission.
3. Enter title: "Test Mission Alpha". Intent: "Build a simple landing page". Create.
4. Open the mission. Screenshot the MissionDetail page (empty state).
5. Click Admit Contract. Type: `execution`. Title: "Implement landing page". Create.
6. Screenshot: contract visible with status `pending`.
7. Click "Launch Linked Run" on the contract.
8. In CreateRun, select provider/model/workspace. Start.
9. Wait for run to complete. Observe MissionDetail updating in real-time.
10. Screenshot: contract `fulfilled`, validation record visible, artifacts visible, projection updated.

### Action sequence — Failure path

11. Admit a second contract: "Implement impossible feature".
12. Launch a linked run with a prompt designed to fail (e.g., empty workspace, impossible goal, or kill the process mid-execution).
13. Screenshot: contract `failed`, validation record with fail outcome.

### Action sequence — Restart test

14. Close the app completely (File → Exit or task manager).
15. Wait 5 seconds.
16. Reopen the app.
17. Navigate to "Test Mission Alpha".
18. Screenshot: all data from steps 10 and 13 is intact.
19. Compare screenshots from step 10 and step 18. They must show identical data.

### Action sequence — Idempotence test

20. If possible, manually trigger `reconcile_run_status` for an already-completed run (via test harness or by replaying the event).
21. Check PG: no duplicate validation records, no duplicate resume snapshots, no contract status change.

### Evidence to capture

- 4+ screenshots: empty mission, contract admitted, post-success run, post-restart
- Optional: screen recording of the full flow
- PG query output: `SELECT * FROM validation_records WHERE mission_id = '<test_mission_id>'` — must show exactly 1 record per run, not duplicates
- PG query output: `SELECT * FROM resume_snapshots WHERE mission_id = '<test_mission_id>'` — must show exactly 1 snapshot per terminal run

---

## 14. Failure Conditions and Rollback Rules

### Conditions that prove the slice is not yet solid

1. **MissionDetail does not update automatically after run completion.** Cause: `mission-projection-updated` event not firing or not received. Fix: debug the event emission path in `runs.rs` and the listener in MissionDetail. Do not proceed to demo until this works.

2. **Validation Feed shows no records or wrong data.** Cause: likely a type mismatch between backend `ValidationRecord` (with `outcome` and `validation_scope`) and frontend type (with `is_passing` and `validation_type`). Fix: align the TypeScript type with the Rust serialization.

3. **Duplicate records appear after repeated reconciliation.** Cause: idempotence guard is broken. Fix: check the `already_handled` logic for validation records. Add idempotence check for resume snapshots.

4. **Contract status shows `pending` even after run is running/done.** Cause: reconciliation did not fire, or contract status update failed silently. Fix: add logging to `reconcile_run_status_core`, verify `update_status` in contracts repository is actually executing.

5. **After app restart, MissionDetail shows empty panels.** Cause: PG did not restart, pool did not reconnect, or data directory was in a temp location. Fix: verify `runtime_pgsql.rs` data directory path. Verify `db.rs` pool initialization in `main.rs` startup sequence.

6. **CreateRun does not receive mission_id/contract_id from navigation.** Cause: navigation state not propagated correctly. Fix: trace the navigation state from MissionDetail line 406 through the app's routing to CreateRun.

### When to stop adding features and fix correctness

- If any of the 10 acceptance criteria from Section 12 fail, stop all work and fix the failing criterion before touching anything else.
- If the event emission path is broken, this is the highest priority fix — the entire real-time UX depends on it.
- If the type mismatch between backend and frontend is confirmed, fix it immediately — it will silently break all validation feed rendering.
- Do not add any feature from the "out of scope" list (Section 4) while any acceptance criterion is failing.

---

## 15. Post-Slice Decision Gate

After the vertical slice passes all acceptance criteria and the demo protocol is completed, the only valid next decision options are:

### Option A: Harden the wedge

If the slice works but is fragile (e.g., relies on specific timing, has edge cases in reconciliation, PG startup is slow), spend 1-2 weeks hardening:
- Add automated tests for the reconciliation truth table
- Add a startup self-check that queries PG for mission state integrity
- Add basic error recovery for PG connection loss during a run

### Option B: Execute the competitive audit

If the slice works reliably, execute the competitive audit defined in `docs/strategic_reset_and_wedge_plan.md` Section 5. The audit determines whether the mission continuity wedge is genuinely differentiated. Do not productize the demo until the audit confirms the gap.

### Option C: Productize the demo

If the slice works reliably AND the audit confirms the gap, package the proof as a shareable demo:
- Record a screen capture of the full flow
- Write a README section describing the mission continuity feature
- Build a distributable .exe (Tauri production build)

### Option D: Contribute structured events upstream

If the proof reveals that the 3-event CLI vocabulary (`run.started`, `run.completed`, `run.failed`) is insufficient for reliable continuity — for example, the bridge cannot distinguish between agent-initiated failure and infrastructure failure — then the correct next step is proposing a richer event schema to upstream OpenClaw. This is a contribution, not a fork modification.

### Option E: Reassess the wedge

If the competitive audit reveals the gap is already filled, or if the slice cannot be made reliable within the current architecture, return to `docs/strategic_reset_and_wedge_plan.md` and reassess the wedge options. This is not failure — it is informed decision-making.

**Do not open a broad roadmap. Do not plan Sprint 8 features. Do not scope governance, branching, or multi-agent work. The next valid action is one of these five options.**
