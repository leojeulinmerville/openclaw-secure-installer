# Sprint 0 Closure (Zero Config MVP)

This release marks the functional closure of **Sprint 0** for OpenClaw Mission Control.

The project now includes a fully packaged, zero configuration embedded PostgreSQL runtime for the Windows desktop application. The canonical data store is bootstrapped automatically on first launch, without requiring any manual PostgreSQL installation or user setup.

## What is now working

### Embedded PostgreSQL runtime
The application now ships with its own PostgreSQL 16 Windows runtime bundled directly inside the installer.

At startup, the app resolves the bundled archive, extracts the runtime into the user's local AppData directory, validates the required binaries, and prepares the canonical local database environment.

### Deterministic bootstrap chain
The backend now executes a deterministic bootstrap sequence:

1. Extract bundled PostgreSQL binaries into `AppData/runtime/pgsql`
2. Initialize the local cluster with `initdb`
3. Detect and clean stale `postmaster.pid` locks when safe
4. Select a free local TCP port dynamically
5. Start PostgreSQL and wait for readiness using `pg_isready`
6. Initialize SQLx and apply migrations automatically

### Canonical schema foundation
The canonical MVP schema is now in place with the core persistent mission objects, including:

- missions
- mission_charters
- case_files
- mission_state_projections
- contracts
- artifacts
- decision_records
- validation_records
- resume_snapshots

The schema includes UUIDs, constraints, triggers, and migration support.

## Packaging validation
This release was validated both in development and through the packaged Windows installer flow.

The packaged application was tested on a clean Windows environment and successfully completed the full bootstrap chain end to end:

- bundled ZIP resolved correctly
- runtime extracted to AppData
- cluster initialized successfully
- PostgreSQL started on a dynamic local port
- readiness confirmed
- SQLx connected successfully
- migrations applied successfully

## Distribution
The generated Windows installers bundle PostgreSQL out of the box.

No external database installation is required.
No manual configuration is required.
The application is now capable of bootstrapping its canonical local data layer automatically on first launch.

## Notes
This release closes Sprint 0 at the runtime and packaging level.

Items intentionally left for the next sprint include:
- robust PostgreSQL shutdown and child process lifecycle tracking
- backend to frontend health event propagation
- repository and service layer above SQLx
- gateway and sandbox integration
- installer payload size optimization
