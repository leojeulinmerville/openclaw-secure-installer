# OpenClaw Adversarial Repo Audit Note

## Status

This note is a retained adversarial audit companion for the build phase.
It is not the doctrinal source of truth.
It exists to preserve hard repo grounded feedback, prevent drift, and sharpen implementation choices during Sprint 1 and after.

The doctrinal source of truth remains the frozen Master Orchestration Matrix V1 and the supporting V2 aligned architecture specs.

## Durable build truths retained from the audit

1. PostgreSQL local must remain the canonical mission truth.
2. Session stores, run metadata, transcripts, flat run files, and UI state must not become canonical mission truth.
3. Mission Coordinator must remain the persistent authority layer for mission state.
4. Gateway must not become a parallel orchestrator or mission authority.
5. Contract must not be collapsed into run, spawned sub agent, or nested session.
6. Logical roles must not be mapped one to one to concrete agents or components.
7. Case File must not be replaced by transcript plus metadata.
8. Responsibility Ledger must not be inferred naively from raw transcript events.
9. Mission Control must remain a projection, not a source of truth.
10. Legacy runtime anchors may help transition, but must not harden into canonical persistence by inertia.

## Anti patterns to carry into the build phase

1. Parallel orchestrator duplication
2. UI becoming truth
3. Contract equals run confusion
4. Session equals mission confusion
5. Transcript equals Case File confusion
6. Logs or events equals Decision Record confusion
7. Role equals component confusion
8. Transitional store becoming canonical by inertia
9. Gateway centric overreach
10. Capability layer contaminating the first wave mission core

## Repo grounded guardrails

### Canonical truth

Canonical mission truth must be written by the Mission Coordinator into PostgreSQL.
Raw logs, stdout or stderr, `events.jsonl`, `meta.json`, temporary desktop state, or gateway runtime state are signals only.

### Execution substrate

The current execution substrate remains reusable, but it stays downstream of mission authority.
The coordinator governs.
The execution substrate executes.
The UI projects.

### Contract boundary

A Contract is a governed activation unit.
A run is only one possible operational episode attached to a Contract.
No implementation shortcut should erase this boundary.

### Case File boundary

The Case File is a governed continuity object.
It may absorb distilled information from transcripts and metadata, but it must never be replaced by them.

### Ledger boundary

The Responsibility Ledger must be an explicit canonical record of ratified decisions and responsibility carrying actions.
It is not a derived convenience view over raw chat or execution traces.

## What to keep but not freeze too literally

### Exact placement of the Mission Coordinator implementation

The doctrine fixes the function, not the final implementation host.
Node and Rust remain plausible implementation locations as long as the coordinator is persistent, canonical, and correctly placed between control surface and execution substrate.

### Exact repo seams proposed by adversarial mapping

Specific anchors proposed by adversarial audit are useful working candidates, not frozen truth.
They still require repo inspection before implementation commitment.

### Gateway wording

The Gateway should be treated as an execution and communication substrate, not as mission authority.
Exact seam placement still depends on final repo grounded integration choices.

## Documentation handling rule

This note should be used during:

1. Sprint 1 execution planning
2. Repo seam selection
3. Implementation review
4. Architecture drift checks
5. Gemini or external audit iterations

This note should not be used to reopen the already frozen doctrine unless a true contradiction with repo reality is discovered.

## Practical usage during Sprint 1

Before validating any implementation step, ask five questions:

1. Does this move write canonical truth into PostgreSQL, or does it leave truth in legacy runtime artifacts?
2. Does this move preserve the distinction between Mission, Contract, run, and artifact?
3. Does this move keep Mission Control as a projection instead of a source of truth?
4. Does this move avoid creating a second orchestrator beside the existing engine?
5. Does this move keep first wave scope limited to the canonical mission core?

If one of these checks fails, the implementation should be challenged before merge.

## Recommended relationship to Sprint structure

This audit note supports Sprint 1 and Sprint 2.

Sprint 1 should use it to protect the canonical core:
Mission, Charter, Case File, Contract, Artifact, Decision Record, Validation Record, Resume Snapshot, Responsibility Ledger Entry, MissionControlMissionView, and the minimal coordinator services.

Sprint 2 should use it to protect the bridge phase:
linking runs and gateway signals to canonical records without letting runtime traces become truth.

## Final reminder

The most dangerous false equivalence to avoid is this:

`runs/meta.json` or `events.jsonl` equals Case File, or runtime events equal Ledger.

If that false equivalence survives, the system remains an ephemeral runner with supervision theater instead of becoming a governed mission system.
