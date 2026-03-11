# Sprint 0 Closure Execution Plan

## 1. Closure Objective
The objective is to finalize the Sprint 0 foundation by resolving the missing PostgreSQL binary resource, fixing the startup race condition between the database process and the SQLx connection, and completing the canonical database schema. This closure is mandatory to authorize Sprint 1 (Mission Coordinator).

## 2. Current Blockers to Sprint 1
- **Missing Resource**: `resources/postgresql-windows-x64.zip` is absent, preventing runtime testing.
- **Race Condition**: `main.rs` does not wait for PostgreSQL to be ready before initializing SQLx.
- **Incomplete Schema**: Migration only covers `missions` and `charters`, missing 7 core canonical tables.
- **Fragile Shutdown**: Database shutdown is only tied to window events, leading to zombie processes on forced exits.

---

## 3. Workstream A: PostgreSQL Runtime Packaging Closure
**Goal**: Ensure the binary bundle is correctly placed and the extraction logic handles a real binary distribution.

*   **Files to create/modify**:
    *   `resources/postgresql-windows-x64.zip` (MUST BE PROVISIONED)
    *   `desktop/src-tauri/tauri.conf.json` (Verify resources entry)
*   **Dependency Chain**: None.
*   **Technical Risks**: Large bundle size affecting build times.
*   **Implementation Notes**: Use a minimal PostgreSQL distribution (binaries only, no docs/symbols).
*   **Done Criteria**: The ZIP file exists in the resources folder and is correctly detected by `PgRuntimeManager`.
*   **Manual Validation**: Run the app and check if `AppData/Local/ai.openclaw.myopenclaw/runtime/pgsql/bin/postgres.exe` exists.

## 4. Workstream B: Startup Readiness and Health Sequencing
**Goal**: Implement a "wait for readiness" mechanism to ensure the DB is listening before SQLx attempts connection.

*   **Files to create/modify**:
    *   `desktop/src-tauri/src/runtime_pgsql.rs` (Modify `start_server` or add `wait_for_ready`)
    *   `desktop/src-tauri/src/main.rs` (Sequencing in `setup`)
*   **Dependency Chain**: Workstream A (to test).
*   **Technical Risks**: Infinite loops if DB fails to start.
*   **Implementation Notes**: Use a TCP probe on the target port or poll `pg_isready.exe` for up to 10 seconds.
*   **Done Criteria**: `db::init_db` is only called after the DB port is confirmed open.
*   **Manual Validation**: Delete the data folder, start the app, and verify no "DB Init Error" occurs during the first initialization.

## 5. Workstream C: Canonical Schema Completion
**Goal**: Align the database schema with `spec_case_file_canonical_state_minimal.md`.

*   **Files to create/modify**:
    *   `desktop/src-tauri/migrations/20260311000000_init_core.sql` (Update)
*   **Dependency Chain**: None.
*   **Technical Risks**: SQL syntax errors in complex table relations.
*   **Implementation Notes**: Add tables: `case_files`, `contracts`, `artifacts`, `decision_records`, `validation_records`, `resume_snapshots`, `mission_state_projections`. Ensure `pgcrypto` is enabled for UUID generation.
*   **Done Criteria**: All 9 canonical tables are present in the database.
*   **Manual Validation**: Use a SQL client to inspect the schema after migration.

## 6. Workstream D: End-to-end Validation
**Goal**: Verify the full lifecycle: Provision -> Init -> Migration -> Query -> Shutdown -> Restart.

*   **Files to create/modify**:
    *   `desktop/src-tauri/src/db.rs` (Add a simple sanity check query)
*   **Dependency Chain**: Workstreams A, B, C.
*   **Technical Risks**: State corruption on restart.
*   **Done Criteria**: App boots and reaches "ready" state on both fresh install and subsequent launches.
*   **Manual Validation**: Full install and reboot cycle.

---

## 7. Ordered File by File Execution Sequence
1.  **Update Migration**: `desktop/src-tauri/migrations/20260311000000_init_core.sql` (Complete the schema).
2.  **Add Readiness Check**: `desktop/src-tauri/src/runtime_pgsql.rs` (Implement `wait_for_ready` logic).
3.  **Fix Startup Sequence**: `desktop/src-tauri/src/main.rs` (Await readiness before `init_db`).
4.  **Add Health Query**: `desktop/src-tauri/src/db.rs` (Verify schema version or table count).
5.  **Provision Resource**: Place `postgresql-windows-x64.zip` in `desktop/src-tauri/resources/`.

## 8. Validation Checklist
- [ ] ZIP file is present in `resources/`.
- [ ] `init_core.sql` contains all 9 tables from the minimal spec.
- [ ] `runtime_pgsql.rs` contains a port-wait loop or `pg_isready` check.
- [ ] `main.rs` awaits the DB start before spawning the SQLx pool.
- [ ] App logs "Connected to PostgreSQL" AFTER "PostgreSQL started".
- [ ] `postgres.exe` terminates when the app closes.

## 9. Definition of Done for Sprint 0 Closure
- PostgreSQL runtime manager extracts, initializes, and starts correctly.
- Application waits for DB readiness before attempting any SQL operations.
- Full 9-table canonical schema is applied via SQLx migrations.
- App shutdown successfully stops the local PostgreSQL process.
- Environment is stable and testable, providing a clean foundation for Sprint 1.

## 10. Explicit Out of Scope Items
- Implementing `MissionCoordinator` logic (Contract state machine, etc.).
- Creating the `MissionDetail` UI page.
- Implementing the `CapabilityRegistry`.
- Multi-machine or Docker-based PostgreSQL setups.

---

## Recommended first implementation step
**Action**: Update the canonical schema in `desktop/src-tauri/migrations/20260311000000_init_core.sql`.

*   **Why**: This is the most foundational correction. Without the correct schema, even a successful DB connection is useless for the next sprints. It defines the "shape" of the truth we are trying to manage.
*   **Files involved**: `desktop/src-tauri/migrations/20260311000000_init_core.sql`.
*   **Success looks like**: The migration file contains definitions for Missions, Charters, Case Files, Contracts, Artifacts, Decision Records, Validation Records, Snapshots, and Projections.
