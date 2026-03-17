# docs/sprint_2_execution_bridge_plan.md

## 1. Sprint 2 objective

Deliver the Embedded Hybrid execution bridge between the canonical mission core and the existing OpenClaw execution substrate.

Sprint 2 must make it possible for the Mission Coordinator to:
- launch or attach an execution run under explicit `mission_id` and `contract_id`
- observe execution signals without letting logs become canonical truth
- reconcile a minimal subset of execution facts into PostgreSQL canonical records
- refresh Mission Control projections from canonical state
- preserve the current OpenClaw engine rather than replacing it

## 2. Confirmed in scope

Sprint 2 is strictly about the execution bridge. The main in-scope items are:

### 2.1 Run linkage
- define the canonical linkage between Mission, Contract, and runtime execution
- ensure a run can be launched or attached with explicit `mission_id` and `contract_id`
- persist the run linkage in canonical storage

### 2.2 Execution seam audit and bridge insertion
- inspect the real current CLI and desktop launch path
- identify the exact seam where the Mission Coordinator can authorize and track execution
- insert the coordinator without creating a second orchestrator

### 2.3 Runtime signal interpretation
- identify which execution signals are useful for canonical reconciliation
- distinguish operational trace from institutional record
- define the minimal signal subset to consume in Sprint 2

### 2.4 Canonical reconciliation
- write minimal canonical updates derived from execution
- update Contract state and mission projection based on governed reconciliation
- keep `events.jsonl`, `meta.json`, transcripts, and raw logs as signals only

### 2.5 Projection refresh
- ensure Mission Control projections refresh from canonical state after meaningful execution changes
- avoid any UI reconstruction of truth from raw run artifacts

### 2.6 Minimal API and service bridge
- add only the minimal commands, services, and repositories required to support the execution bridge
- keep the bridge narrow, explicit, and reversible

## 3. Explicit out of scope

Sprint 2 must not absorb later richness. The following are out of scope unless strictly required by the bridge:

- full Capability Registry
- rich Intervention system
- rich Recovery orchestration
- full Evidence Bundle persistence model
- full Failure Event persistence model
- broad Gateway governance redesign
- speculative event bus architecture
- broad UI redesign
- full multi channel mission ingestion
- second wave policy richness

## 4. Repository grounded current starting point

The repo now appears to have:
- a PostgreSQL backed canonical mission core
- a Mission Coordinator minimal authority layer
- canonical records for Mission, Mission Charter, Case File, Contract, Artifact, Decision Record, Validation Record, Resume Snapshot, Responsibility Ledger Entry
- a Mission Control read model or equivalent projection
- UI pages reading mission state from canonical commands rather than from local flat files

The key remaining gap is the bridge between this canonical core and the existing execution substrate:
- current CLI run engine
- run artifacts such as `events.jsonl` and `meta.json`
- desktop launched runs
- possible gateway related execution or routing seams

Sprint 2 starts from the assumption that Sprint 1 is closed against its own plan, while the full Embedded Hybrid bridge remains incomplete.

## 5. Sub block A: execution seam audit first

Before coding the bridge, perform a real repo audit of the execution path.

### 5.1 Audit questions
Answer at minimum:
- what exact module starts the current CLI run
- where run IDs are created today
- where run metadata is persisted today
- where approval interception occurs today
- where desktop triggers execution today
- whether gateway paths participate in execution launch or only in communication routing
- what exact runtime signals are available synchronously and asynchronously
- what exact seam is safest for injecting `mission_id` and `contract_id`

### 5.2 Required output of the audit
Produce a concrete map of:
- launch entrypoint
- execution process boundary
- approval boundary
- log and event artifact boundary
- canonical reconciliation insertion point

### 5.3 Hard rule
Do not begin bridge implementation before the seam audit is explicit and file grounded.

## 6. Sub block B: canonical run linkage model

### 6.1 Goal
A run must no longer be an orphan execution episode. It must become explicitly linked to mission authority.

### 6.2 Minimal required linkage
Sprint 2 must define and persist at minimum:
- `run_id`
- `mission_id`
- `contract_id`
- launch timestamp
- current execution status
- optional source channel or launch origin
- optional pointer to legacy runtime artifact paths

### 6.3 Design rule
The run linkage record must not redefine Mission or Contract.
It only binds operational execution to canonical mission objects.

### 6.4 Acceptance rule
A run launched through the supported path must be traceable from:
- Mission
- Contract
- run linkage
- current projection

## 7. Sub block C: execution bridge service layer

### 7.1 Minimal service responsibilities
Sprint 2 should introduce or extend only the minimal services needed for the bridge.

Recommended service responsibilities:
- execution bridge service
- run linkage repository
- canonical reconciliation logic inside the coordinator or a dedicated narrow bridge service
- projection refresh hook after meaningful execution changes

### 7.2 What this layer must do
- authorize execution launch from canonical mission context
- pass mission and contract linkage into the execution path
- observe execution signals
- reconcile a minimal subset into canonical state
- refresh projection after governed updates

### 7.3 What this layer must not do
- replace the CLI engine
- make raw logs canonical
- let the UI infer truth
- create a second orchestration state machine outside the coordinator

## 8. Sub block D: minimal canonical reconciliation

### 8.1 Principle
Reconciliation in Sprint 2 must be minimal and governed.

Do not ingest every runtime event.
Only reconcile events that matter institutionally.

### 8.2 Minimal execution signals recommended for Sprint 2
At minimum evaluate:
- run started
- run completed
- run failed
- approval requested
- approval resolved
- artifact produced if this can be identified safely
- contract relevant transition point if already observable

### 8.3 Canonical outcomes expected
The bridge should enable updates such as:
- Contract lifecycle progression
- Decision Record or Validation Record creation where justified
- Responsibility Ledger entry where a governed transition occurs
- projection refresh with latest decision or validation summary
- mission health or blocker updates where appropriate

### 8.4 Hard rule
Raw `events.jsonl`, transcripts, and `meta.json` remain evidence or signals only.
They do not become the Case File, Ledger, or mission truth.

## 9. Sub block E: Mission Control projection continuity

### 9.1 Goal
Mission Control must remain a read model over canonical truth even after execution bridge work begins.

### 9.2 Required outcomes
After Sprint 2 bridge work:
- a launched run should be reflected canonically
- contract related execution progress should be visible through projection updates
- run failure should influence canonical mission view only through coordinator reconciliation
- UI must still read canonical commands, not raw run files

## 10. Implementation sequence

### Step 1
Execution seam audit

### Step 2
Minimal run linkage schema and repository

### Step 3
Launch path adaptation so supported runs carry `mission_id` and `contract_id`

### Step 4
Coordinator bridge for minimal execution signal reconciliation

### Step 5
Projection refresh from reconciled canonical updates

### Step 6
Proof pass validating that the bridge works without making raw runtime traces canonical

## 11. Validation checkpoints

### Checkpoint A
A mission can have at least one admitted Contract that can be selected for execution.

### Checkpoint B
A supported run can be launched or attached with explicit `mission_id` and `contract_id`.

### Checkpoint C
The run linkage is persisted canonically.

### Checkpoint D
At least one minimal execution signal path is reconciled into canonical state.

### Checkpoint E
Mission Control projection updates from canonical state after execution relevant changes.

### Checkpoint F
No UI page needs to parse `events.jsonl`, `meta.json`, or similar files to know mission truth.

## 12. Sprint 2 exit criteria

Sprint 2 can be considered complete when all of the following are true:
- a real execution path is linked explicitly to `mission_id` and `contract_id`
- the Mission Coordinator or bridge layer can reconcile a minimal subset of execution signals into PostgreSQL canonical state
- Mission Control projection reflects the reconciled canonical state
- the existing engine is still reused rather than replaced
- raw runtime traces remain non canonical
- the bridge is narrow, repo grounded, and does not create a second orchestrator

## 13. Deliverable expectation

The Sprint 2 implementation must end with:
- exact files changed
- exact schema delta
- exact run linkage mechanism
- exact reconciliation write paths
- exact projection refresh path
- clear statement of what remains for later richer runtime governance

## 14. Final design rule

Sprint 2 is not a rewrite.
It is the minimal Embedded Hybrid bridge that connects the canonical mission core to the existing execution substrate safely and explicitly.
