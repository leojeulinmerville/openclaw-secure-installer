# Sprint 6 Closure Verdict and Strict Sprint 7 Plan

## 1. Sprint 6 Closure Verdict

### Final status
Sprint 6 is accepted as a Mission Control MVP observability sprint, not as final proof of the whole mission system.

### What Sprint 6 appears to close
If the implementation summary is accurate, Sprint 6 completes the missing read side needed for a credible Mission Control MVP surface:

- mission header and live state projection already present
- active contracts visible in Mission Detail
- discovered artifacts visible in Mission Detail
- linked runs visible in Mission Detail
- decision feed visible through coordinator backed reads
- validation feed visible through coordinator backed reads

This is materially aligned with the Mission Control MVP requirement that the operator should understand mission state from canonical data rather than raw logs alone.

### What Sprint 6 does not prove by itself
Sprint 6 does not by itself prove end to end runtime truth.

Clean `cargo check` and `pnpm build` only prove structural coherence. They do not prove that the mission loop is stable in runtime.

The real system proof remains:

- create a persistent mission
- admit at least one persistent contract
- launch a run explicitly linked to `mission_id` and `contract_id`
- observe canonical updates in PostgreSQL backed mission state
- observe Mission Control reading that state coherently
- restart the app and confirm the state remains readable and resumable

### Closure statement
**Sprint 6 is accepted as a UI observability completion sprint.**

It should not yet be described as full product validation or as sufficient justification to jump immediately into branching, sub agents, or rich evidence governance.

## 2. Why Sprint 7 must be a proof sprint

The strongest lesson from the feasibility audit is simple:

- specs are the map
- runtime behavior is the territory
- UI panels are only valuable if they are fed by canonical mission state
- the coordinator must remain the authority for anything touching mission data

The audit also says later layers such as sub agents, governance, and evidence richness should not be forced before the mission lifecycle is proven end to end.

That means Sprint 7 should not be a complexity sprint.
It should be a truth sprint.

## 3. Sprint 7 Title

**Sprint 7: Runtime Proof and Minimal Operator Authority**

## 4. Sprint 7 Objective

Prove that the coordinator centered mission loop works in runtime, and close the remaining minimum operator actions expected by Mission Control MVP.

## 5. Confirmed In Scope

### A. Runtime end to end proof
Run real scenarios that prove the coordinator is the practical mission authority and not only a better organized code path.

Target proof sequence:

1. create a mission
2. admit a contract
3. launch a linked run through the coordinator path
4. observe contract state changes
5. observe validation and decision outputs when applicable
6. observe artifacts linked back into mission context
7. observe projection refresh in Mission Control
8. restart the app and confirm state remains coherent

### B. Minimal operator actions
Implement or finish the smallest real operator action surface required by Mission Control MVP:

- pause mission
- resume mission
- refresh state
- open details
- add intervention minimal

These must be real coordinator backed actions, not cosmetic buttons.

### C. Terminal state hardening
Verify and harden success, failure, cancellation, and interruption paths so canonical state remains coherent.

Focus points:

- contract status transitions are legal and consistent
- validation records are written once and correctly classified
- decision records remain coherent if emitted
- artifacts are not duplicated by terminal replay
- projection refresh happens after canonical writes
- resume snapshots stay queryable and meaningful

### D. Restart and resume proof
Close the app and reopen it.
Mission Control must reconstruct a stable mission view from PostgreSQL canonical state.
If supported today, verify minimal controlled resumption after interruption.

### E. Idempotence checks
Repeated observation of the same terminal event must not corrupt state.

Validate:

- no duplicate validation records
- no illegal second contract transition
- no repeated artifact insertion
- no contradictory projection state

## 6. Explicit Out of Scope

Sprint 7 must not include:

- multi agent orchestration
- governed branching
- rich evidence bundles explorer
- policy engine or OPA layer
- capability registry lifecycle
- provider and channel expansion
- committee logic
- advanced recovery taxonomy

These are later capability layers.
They should not be used to avoid proving the current mission loop.

## 7. Execution Order

### Sub block A: truth table scenarios
Run and document the exact scenarios below:

1. linked run succeeds
2. linked run fails
3. linked run is cancelled or interrupted
4. same mission with multiple contracts
5. multiple linked runs do not contaminate each other
6. app restart after terminal run
7. app restart before completion, if current runtime supports it

### Sub block B: action wiring verification
Verify each action is real and coordinator backed:

1. pause mission
2. resume mission
3. refresh state
4. open details
5. add intervention minimal

### Sub block C: reconciliation hardening
Inspect the terminal reconciliation path and verify:

1. canonical writes happen before projection refresh
2. retries or repeated terminal processing stay safe
3. contract transitions remain legal
4. validation output stays deduplicated
5. snapshots stay meaningful for resume

### Sub block D: proof artifact
Produce one repo grounded proof document with:

- commands executed
- exact flow tested
- UI observations
- canonical state observations
- restart observations
- remaining failure cases
- final verdict

## 8. Acceptance Criteria

Sprint 7 is complete only if all of the following are true:

1. a mission can be created and a contract admitted
2. a mission bound launch goes through the Mission Coordinator path
3. a successful linked run updates canonical state coherently
4. a failed linked run updates canonical state coherently
5. pause mission produces a real governed state change
6. resume mission produces a real coordinator backed state continuation or preparation flow
7. after app restart, Mission Control still reads a stable canonical mission view
8. repeated terminal observation does not corrupt records or statuses
9. the operator can understand mission state without raw logs
10. no Sprint 7 success claim depends on pretending sub agents or branching already exist

## 9. Recommended Runtime Test Matrix

### Scenario 1: Success path
- create mission
- admit contract
- launch linked run
- verify contract reaches expected terminal status
- verify validation record written
- verify artifacts visible
- verify Mission Detail reflects all of it

### Scenario 2: Failure path
- create mission
- admit contract
- force run failure
- verify failed status
- verify failing validation record
- verify projection remains readable

### Scenario 3: Cancellation or interruption
- start linked run
- stop or interrupt flow
- verify canonical terminal semantics are explicit and non ambiguous

### Scenario 4: Restart safety
- finish a linked run
- close app
- reopen app
- verify same mission state is reconstructed from canonical storage

### Scenario 5: Duplicate terminal replay safety
- replay or re observe terminal state if technically possible
- verify no duplicate records or broken status progression

## 10. Final Recommendation

Do not jump directly to Sprint 8 as sub agents.

The right next milestone is not more complexity.
It is proof that the mission centered authority shift actually holds in runtime.

Once Sprint 7 proves one stable mission slice end to end, later additions such as richer intervention, evidence structure, branching, and sub agent routing become much more legitimate and much less speculative.

## 11. Reality Check Files to Use After Sprint 7

Use these files deliberately after implementation:

- `architecture_feasibility_audit.md` as the hard reality baseline
- `openclaw_dev_feedback_prompt` as the adversarial challenge prompt

Recommended usage:

1. complete the sprint
2. run the proof scenarios
3. compare the claimed result against `architecture_feasibility_audit.md`
4. use `openclaw_dev_feedback_prompt` to challenge whether the repo reality truly matches the claim
5. only then accept the sprint as complete

This keeps sprint inspiration grounded in repo truth instead of drifting into spec inflation.
