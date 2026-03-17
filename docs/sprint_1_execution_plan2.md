# Sprint 1 Execution Plan

## 1. Sprint 1 objective

Sprint 1 makes the minimal canonical mission core real.

Its objective is not to improve the current run UX, not to enrich the Gateway, and not to build the full V2. Its objective is to make Mission exist as a persistent governed object, backed by local PostgreSQL, with a Mission Coordinator authority layer, minimal canonical records, and a first stable Mission Control projection contract.

Sprint 1 is successful when OpenClaw can:

- create a real persistent Mission
- attach a Mission Charter and a Case File to it
- admit and track persistent Contracts
- attach Artifacts, Decision Records, Validation Records, Resume Snapshots, and Responsibility Ledger Entries to the Mission
- maintain a minimal canonical Mission Control projection
- expose these objects through an internal API without depending on raw run files as truth

## 2. Confirmed in-scope

Sprint 1 is strictly limited to the first-wave canonical core.

### 2.1 Canonical persistence layer

In scope:

- validate the actual Sprint 0 schema already delivered
- extend that schema only where strictly required for the first-wave canonical core
- keep PostgreSQL local as the canonical mission store
- keep SQL migrations as the only sanctioned path for schema evolution

### 2.2 Canonical objects to make real

In scope:

- Mission
- Mission Charter
- Case File
- Contract
- Artifact
- Decision Record
- Validation Record
- Resume Snapshot
- Responsibility Ledger Entry
- MissionControlMissionView or equivalent backend projection contract

### 2.3 Mission Coordinator minimal authority layer

In scope:

- create the minimal Mission Coordinator skeleton in the product backend layer
- give it authority to create and read canonical mission objects
- give it authority to update canonical state for first-wave transitions
- keep it between control surface and execution substrate conceptually, even if the execution bridge remains incomplete in Sprint 1

### 2.4 Internal service layer

In scope:

- Mission Service
- Charter and Case File Service
- Contract Service
- Artifact and Validation Service
- Decision and Ledger Service
- Resume Service
- Mission Control Projection Service

These services may start thin, but they must embody canonical responsibilities rather than letting UI logic or flat files keep acting as truth.

### 2.5 First-wave internal API

In scope:

- create mission
- get mission state
- list missions
- list active contracts
- record decision
- record validation
- create resume snapshot
- evaluate resume readiness at a minimal level
- expose MissionControlMissionView or equivalent read model

### 2.6 Read-only Mission Control data seam

In scope:

- define the backend projection needed for Mission Control MVP
- expose enough data for Mission Header, Reference Trajectory basics, Active Contracts preview, Recent Artifacts preview, Decision and Validation summary, and Resume panel summary
- keep UI work minimal and subordinate to backend truth

## 3. Explicit out-of-scope

Sprint 1 must not silently absorb Sprint 2, Sprint 3, or second-wave doctrine.

Out of scope:

- reopening Sprint 0 runtime bootstrap work
- replacing PostgreSQL with SQLite or any file-based truth layer
- treating `runs/{run_id}/meta.json`, `events.jsonl`, transcripts, or UI state as canonical mission persistence
- full bridge from CLI runs to canonical state reconciliation
- full Gateway integration as mission input source
- full Recovery Service
- full Intervention Service
- full Evidence Bundle persistence
- full Failure Event persistence
- full Capability Registry lifecycle
- branching engine
- committee engine
- policy engine beyond the minimal authority boundaries already needed by Sprint 1
- advanced Mission Control UI buildout
- any UI promise whose backend truth is not produced yet
- speculative tables for medium-term features
- rewriting the execution engine
- building a second orchestrator parallel to the existing engine

## 4. Repository-grounded current starting point

The current repo already gives three important anchors.

First, the core execution engine is the `openclaw` CLI, and Desktop currently spawns it through Tauri as a background process. The Desktop app is also the current primary orchestrator between user, Gateway, and CLI. The current state of truth is fragmented across `state.json`, `runs/{run_id}/meta.json`, and `runs/{run_id}/events.jsonl`. This is precisely what Sprint 1 must start displacing for mission truth, without breaking the current engine. fileciteturn19file3

Second, Sprint 0 has already established the local PostgreSQL runtime direction and the MVP plan still defines Sprint 1 as the coordinator and persistence layer rather than execution bridging or full UI work. fileciteturn20file13

Third, the official architecture decisions are already closed on the key structural point: PostgreSQL local is the unique canonical source for mission state, the Mission Coordinator is the persistence hub between UI and execution engine, and Mission Control MVP is a supervised projection rather than a source of truth. fileciteturn19file12

So Sprint 1 does not start from nothing. It starts from:

- a running local PostgreSQL substrate already chosen and bootstrapped
- a live CLI execution substrate already present
- a current Desktop control surface already present
- a clear architectural need to introduce a persistent mission authority layer between them

## 5. Sub-block A: schema audit

### 5.1 Objective

Audit the real schema currently delivered by Sprint 0 before adding anything.

This is a real audit, not a disguised rebuild.

### 5.2 Required outcome

Produce a table of:

- existing tables actually present
- existing columns actually present
- missing first-wave objects
- missing first-wave fields
- fields already sufficient as-is
- fields that should not be added yet

### 5.3 Audit standard

Every proposed schema delta must answer five questions:

1. Which first-wave object or transition requires it?
2. Which matrix line or crosswalk need does it support?
3. Why can the current schema not already support it?
4. Is it first-wave essential, second-wave, or speculative?
5. What canonical responsibility would fail if it is omitted?

### 5.4 First-wave schema target

The schema audit may justify first-wave support for these canonical objects only:

- missions
- mission_charters
- case_files
- contracts
- artifacts
- decision_records
- validation_records
- resume_snapshots
- responsibility_ledger_entries
- optional persisted mission_state_projection if required by the chosen implementation seam

### 5.5 Constraints

Do not introduce tables for:

- full evidence bundles
- rich failure taxonomy persistence
- recovery records if not strictly required by Sprint 1
- intervention records if not strictly required by Sprint 1
- committee records
- capability lifecycle management
- branching or graph history beyond minimal first-wave needs

### 5.6 Definition of done for Sub-block A

Sub-block A is done when:

- the actual delivered Sprint 0 schema is documented
- each first-wave missing object has a justified delta or an explicit defer decision
- no speculative schema addition remains
- the resulting schema can support the Sprint 1 internal API and read model

## 6. Sub-block B: repository layer

### 6.1 Objective

Create a repository/data-access layer for first-wave canonical objects so the coordinator and services stop reaching directly into ad hoc stores or UI-driven truth paths.

### 6.2 Required repositories

Create or formalize repository access for:

- Mission
- Mission Charter
- Case File
- Contract
- Artifact
- Decision Record
- Validation Record
- Resume Snapshot
- Responsibility Ledger Entry
- Mission Control projection read model, if persisted or aggregated server-side

### 6.3 Design rule

Repositories must speak in canonical objects and lifecycle transitions, not in UI widgets, run folders, or transcript fragments.

### 6.4 Anti-patterns forbidden here

- repository methods that directly encode UI concerns
- repository methods that parse `events.jsonl` as primary truth
- repository methods that treat run metadata as mission state
- repository methods that bake in second-wave objects prematurely

### 6.5 Definition of done for Sub-block B

Sub-block B is done when:

- each first-wave object has a clear persistence seam
- CRUD is not the only concern, lifecycle-safe writes exist where needed
- coordinator/services can load and persist first-wave state without touching run files as truth
- repository naming and boundaries reflect canonical objects rather than legacy runtime artifacts

## 7. Sub-block C: service layer

### 7.1 Objective

Implement the minimal service responsibilities required for Sprint 1 so the Mission Coordinator can create, update, and expose canonical mission state.

### 7.2 Services to implement now

#### Mission Service

Must support:

- create mission
- get mission
- list missions
- update mission dominant phase / status / health / governance state where justified
- close or pause mission only if first-wave transitions support it cleanly

#### Charter and Case File Service

Must support:

- create or update Mission Charter
- open Case File
- update minimal continuity summaries
- prepare minimal resume-oriented mission summaries

#### Contract Service

Must support:

- create contract
- admit contract
- list active contracts
- update contract lifecycle state

#### Artifact and Validation Service

Must support:

- create artifact record
- update artifact lifecycle state
- open validation
- record validation result at minimal first-wave level

#### Decision and Ledger Service

Must support:

- record significant decision
- record responsibility ledger entry
- list recent significant decisions for projection

#### Resume Service

Must support:

- create resume snapshot
- read latest resume snapshot
- expose resume readiness summary and next safe action at a minimal level

#### Mission Control Projection Service

Must support:

- build MissionControlMissionView from canonical records
- support list and detail read models needed by Mission Control MVP

### 7.3 Definition of done for Sub-block C

Sub-block C is done when:

- first-wave mission creation works end to end through services
- canonical objects can be created and linked without UI-side truth invention
- the projection service can expose a stable mission read model from canonical state
- service responsibilities are not leaked back into the UI or raw execution layer

## 8. Sub-block D: Mission Coordinator skeleton

### 8.1 Objective

Make the Mission Coordinator real enough to own first-wave canonical authority, without yet attempting full execution bridging.

### 8.2 Required responsibilities in Sprint 1

The Mission Coordinator must at minimum:

- receive a create mission request
- create Mission, Mission Charter, Case File, and initial projection material
- admit a first Contract
- record significant decisions and validations through canonical services
- create and expose Resume Snapshots
- expose mission state for Mission Control MVP reads

This directly matches the minimal responsibilities and API shape already fixed in the Mission Coordinator spec. fileciteturn19file4turn19file8

### 8.3 Explicit limit in Sprint 1

The coordinator in Sprint 1 is not yet responsible for a full bidirectional reconciliation bridge from all runtime events. It must own canonical state first. Full runtime reconciliation belongs to the next sprint.

### 8.4 Definition of done for Sub-block D

Sub-block D is done when:

- the coordinator exists as a persistent authority seam in the product backend
- it can create and read canonical mission state through services
- it does not depend on UI state or flat files to define truth
- it can expose the minimal internal API required by Mission Control MVP

## 9. Sub-block E: Mission Control read model seam

### 9.1 Objective

Create the backend read model that Mission Control MVP will eventually consume, but do not promise the full UI yet.

### 9.2 Required read model

Support the minimal mission projection already fixed by the Mission Coordinator and Mission Control specs:

- mission_id
- title
- mode
- phase
- status
- health_state
- governance_state
- reference_path or reference_path_label
- current_focus
- top_blocker
- top_risk
- active_contract_count or active_contracts_preview
- last_decision_summary
- last_validation_summary
- resume_readiness
- needs_human_attention
- updated_at

This is directly aligned with the current Mission Coordinator and Mission Control MVP specs. fileciteturn19file8turn19file16

### 9.3 Constraint

Sprint 1 only needs to make this read model true and consumable. It does not need to ship the full React page or the full interaction model.

### 9.4 Definition of done for Sub-block E

Sub-block E is done when:

- a stable backend projection contract exists
- the projection is derived from canonical records rather than parsed logs
- the projection supports future Mission Header, contracts preview, artifacts preview, recent decisions/validations, and resume summary needs

## 10. Repository-grounded file and seam candidates

This section is intentionally pragmatic and minimal.

### 10.1 Existing seams to reuse

Likely first-wave reuse candidates:

- `desktop/src-tauri/src/runtime_pgsql.rs` for runtime PG lifecycle supervision
- the existing SQL migration path under `desktop/src-tauri/migrations/`
- backend Tauri command layer for exposing a first internal API to the UI
- existing Desktop control flow as the caller of coordinator APIs, without leaving it as truth

### 10.2 Existing seams to treat as signals only

Must not become canonical truth:

- `runs/{run_id}/meta.json`
- `runs/{run_id}/events.jsonl`
- transcript-like runtime outputs
- temporary Tauri UI state
- Gateway session state

This follows the current architecture map and the Mission Coordinator spec, both of which distinguish current runtime traces from future canonical mission truth. fileciteturn19file3turn19file8

### 10.3 Existing seams not to overload in Sprint 1

Do not push first-wave mission truth into:

- Gateway routing logic
- raw CLI run folders
- React page-level state containers
- mock-heavy policy or overview pages

## 11. Main risks and anti-patterns

### 11.1 Parallel orchestrator duplication

Risk:

Creating a new mission layer while still letting Desktop or Gateway act as hidden orchestrator of truth.

Response:

The coordinator must become the canonical authority for first-wave mission state immediately.

### 11.2 UI becoming truth

Risk:

The UI keeps computing or faking mission state from mixed local sources.

Response:

Sprint 1 must expose a backend read model, even if UI consumption remains minimal at first.

### 11.3 Contract equals run confusion

Risk:

Implementation shortcuts reduce Contract to spawned execution episode.

Response:

Contract remains canonical object. Execution linking comes later.

### 11.4 Case File equals transcript confusion

Risk:

Continuity is silently pushed back into run files.

Response:

Case File must exist as canonical structured object in PostgreSQL from Sprint 1 onward.

### 11.5 Second-wave pollution

Risk:

Evidence bundles, recovery richness, intervention richness, capability lifecycle, and branching bloat the sprint.

Response:

Keep them deferred unless a first-wave dependency is strictly proven.

## 12. Validation checkpoints

Sprint 1 should be validated through the following checkpoints.

### Checkpoint A: canonical mission birth

The system can create a Mission, Mission Charter, and Case File in PostgreSQL through the coordinator path.

### Checkpoint B: canonical contract and artifact persistence

The system can persist at least one Contract and one Artifact linked to the Mission.

### Checkpoint C: canonical records exist

The system can write a Decision Record, a Validation Record, a Resume Snapshot, and a Responsibility Ledger Entry in a structured way.

### Checkpoint D: projection exists

The system can expose a MissionControlMissionView-like object from canonical state.

### Checkpoint E: truth boundary is respected

Mission truth does not depend on `events.jsonl`, `meta.json`, or UI state.

### Checkpoint F: Sprint 2 seam is ready

The resulting architecture leaves a clear seam for later linking explicit runtime runs to `mission_id` and `contract_id` without redoing Sprint 1.

## 13. Recommended execution order inside Sprint 1

1. Real schema audit against delivered Sprint 0 state.
2. First-wave migration deltas only where justified.
3. Repository layer for canonical objects.
4. Mission Service plus Charter and Case File Service.
5. Contract Service plus Artifact and Validation Service.
6. Decision and Ledger Service plus Resume Service.
7. Mission Coordinator skeleton and first internal API.
8. Mission Control projection read model.
9. End-to-end validation on canonical create/read/update flows.

## 14. Sprint 1 exit criteria

Sprint 1 is complete when:

- the minimal canonical mission core exists in PostgreSQL
- Mission Coordinator exists as a real authority seam
- first-wave canonical services exist and work
- the Mission Control backend projection contract exists
- no major first-wave truth depends on run files or UI state
- the system is ready for Sprint 2 runtime bridging without reopening Sprint 1 foundations

## 15. Immediate next step after approval

After validating this plan, the first build step is not UI work.
It is the real schema audit against the delivered Sprint 0 database and migrations, followed immediately by the first-wave repository layer.
