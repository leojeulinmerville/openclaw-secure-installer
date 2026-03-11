# Sprint 0 Closure Review

## 1. Objective
The goal of this document is to determine whether Sprint 0 is truly closed and identify mandatory corrective actions before authorizing the start of Sprint 1. This review focuses on the robustness of the local PostgreSQL runtime, the canonical database connectivity, and the minimal schema implementation.

## 2. Observe

### 2.1 PostgreSQL Bundle Presence
- **Observation**: The `postgresql-windows-x64.zip` bundle is missing from the repository.
- **Evidence in repo**: `ls desktop/src-tauri/resources` returns an empty directory (or the ZIP is not listed in the provided tree/ls output).
- **Impact**: The runtime manager cannot extract or initialize the database on a clean install. The "zero config" promise is broken.

### 2.2 Startup Readiness
- **Observation**: The application spawns the `postgres.exe` process and immediately attempts to connect via SQLx in a separate task without waiting for the DB to be ready.
- **Evidence in repo**: `main.rs` (lines 35-51) calls `pg_manager.start_server(5432)` and then spawns `db::init_db(db_url)` asynchronously.
- **Impact**: Race condition. SQLx connection will fail if the DB takes more than a few milliseconds to start (which it usually does during the first run or under load).

### 2.3 Localhost Binding & Security
- **Observation**: The connection string is hardcoded to `localhost`, and `initdb` is called with `--no-auth-local`.
- **Evidence in repo**: `main.rs` (line 44), `runtime_pgsql.rs` (line 90).
- **Impact**: While safe for a local MVP, the reliance on a hardcoded port (5432) without conflict detection will cause crashes if another PG instance is running.

### 2.4 Schema & UUID Generation
- **Observation**: The migration uses `gen_random_uuid()` as a default, but does not ensure the `pgcrypto` extension (or built-in UUID support in PG 13+) is available or enabled if needed.
- **Evidence in repo**: `migrations/20260311000000_init_core.sql` (lines 5, 23).
- **Impact**: Migration might fail on some PG versions if the extension is not pre-enabled, although PG 13+ includes `gen_random_uuid` by default.

### 2.5 Minimal Canonical Kernel Alignment
- **Observation**: The schema covers `missions` and `mission_charters` but lacks `case_files`, `contracts`, `artifacts`, `decision_records`, and `validation_records` which are part of the "minimal canonical state" spec.
- **Evidence in repo**: `migrations/20260311000000_init_core.sql` only contains two tables.
- **Impact**: The current schema is too narrow and still reflects a "run-centric" mindset by omitting the core orchestration objects.

### 2.6 Shutdown Behavior
- **Observation**: Shutdown is handled via `on_window_event`.
- **Evidence in repo**: `main.rs` (lines 56-62).
- **Impact**: This only triggers on window close. If the app is killed, crashes, or closes via other means (e.g., system tray), the `postgres.exe` process becomes a zombie.

### 2.7 First vs Second Launch
- **Observation**: `setup_runtime` checks for `pg_root.exists()`, and `ensure_initialized` checks for `pg_data.exists()`.
- **Evidence in repo**: `runtime_pgsql.rs` (lines 40, 77).
- **Impact**: Correct logic for skipping initialization on second launch, but lacks a "health check" to see if the existing binaries/data are actually valid.

## 3. Think
- **Truly Complete**: The basic supervisor structure in Rust is sound. The use of `AppData` for isolation is correctly implemented.
- **Partially Complete**: SQLx integration is there but fragile (race conditions). Schema is started but incomplete.
- **Missing**: The actual PostgreSQL binary bundle. The core canonical objects (Contracts, Artifacts, Records).
- **Risky**: The startup sequence is highly likely to fail on the first run. The zombie process risk on Windows is high.
- **Blocking Sprint 1**: 
    1. Absence of the ZIP bundle (environment is not testable).
    2. Incomplete schema (Mission Coordinator in Sprint 1 would have no place to store its objects).
    3. Fragile startup/connection sequence.

## 4. Decide
**Decision**: Sprint 0 not yet validated.

**Justification**:
We are not authorized to start Sprint 1 yet. The environment is not operationally testable due to the missing binary bundle, and the canonical schema is missing 70% of the objects required by the "minimal canonical state" specification. Starting Sprint 1 now would lead to building on a broken foundation.

## 5. Required corrective actions before Sprint 1

| Action | Why it is required | Files involved | Severity |
| :--- | :--- | :--- | :--- |
| **Provision ZIP** | Enable actual runtime testing. | `resources/` | Critical |
| **Wait for Readiness** | Prevent SQLx connection race conditions. | `runtime_pgsql.rs`, `main.rs` | Critical |
| **Complete Schema** | Align with `spec_case_file_canonical_state_minimal`. | `migrations/` | High |
| **Robust Shutdown** | Prevent zombie processes on Windows. | `main.rs` | Medium |
| **UUID Prerequisites** | Ensure `gen_random_uuid` works reliably. | `migrations/` | Medium |

## 6. Ordered execution plan for closure
1. **Resource Provisioning**: Place a valid `postgresql-windows-x64.zip` in `resources/`.
2. **Schema Alignment**: Update the initial migration to include `case_files`, `contracts`, `artifacts`, `decision_records`, `validation_records`, and `resume_snapshots`.
3. **Readiness Implementation**: Add a "wait for port" or "wait for pg_isready" logic in `PgRuntimeManager` before returning from `start_server`.
4. **Boot Sequence Fix**: Update `main.rs` to await `start_server` and its readiness before spawning the SQLx pool initialization.
5. **Sanity Test**: Ensure a full install -> boot -> query -> shutdown -> reboot cycle works without errors.

## 7. Definition of done for Sprint 0 closure
- [ ] PostgreSQL ZIP bundle present in `resources/`.
- [ ] `setup_runtime` successfully extracts binaries to `AppData`.
- [ ] `initdb` successfully creates the cluster on first launch.
- [ ] `start_server` waits until the DB is actually listening on the port.
- [ ] SQLx connects and applies migrations only after DB readiness.
- [ ] All 9 core canonical tables (`missions`, `charters`, `case_files`, `contracts`, `artifacts`, `decisions`, `validations`, `snapshots`, `projections`) are created.
- [ ] App shutdown stops the `postgres.exe` process reliably.
- [ ] Second launch starts the DB and connects SQLx without re-extracting or re-initializing.

## 8. Explicit out of scope items
- Rich Mission Coordinator logic (handling complex state transitions).
- Mission Control UI components.
- Advanced governance policies (OPA).
- Branching or Recovery logic.

## Final verdict

Status: Sprint 0 not yet validated

Sprint 1 authorized: No

Reason:
The environment is not operationally testable because the PostgreSQL binary bundle is missing from the repository resources. Furthermore, the current database schema is insufficient, lacking the core canonical objects (Contracts, Artifacts, Records) required for the Mission Coordinator. The startup sequence also contains a critical race condition between the DB process spawn and the SQLx connection attempt.
