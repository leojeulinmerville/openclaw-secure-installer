# Strategic Reset and Wedge Plan

> **Classification**: Internal execution memo — not for external publication.
> **Date**: 2026-03-22
> **Author**: Architecture review, post-critique.
> **Repo**: `openclaw-secure-installer`, branch `main`.
> **Constraint**: One builder. No team. No outside capital. No timeline fantasy.

---

## 1. Executive Reset

An external professor reviewed this project and delivered a direct critique. The core message was:

- The space of AI agent orchestration, Mission Control dashboards, and secure-installer tooling is **already crowded**.
- The project likely has a **competitive intelligence deficit** — it has been designed in isolation without a systematic audit of what already exists in the OpenClaw ecosystem and adjacent projects.
- The current architecture is **conceptually interesting but still narrative**. The V2 constitution (`product_system_v2.md`) describes a system with 30+ named roles, 5 hierarchical levels, 10 mission phases, evidence chains, committees, branching, recovery taxonomies, and capital opératoire governance. The repo has two partially-connected CRUD systems spanning roughly 22 Rust source files, a 308-line Node gateway, and 18 React pages.
- The immediate risk is **building too much, too broadly, and too alone**.
- What is needed is a **precise wedge**, not a general vision.

This critique is correct.

The previous framing positioned this project as something between a governed autonomous production platform, a full Mission Control suite, a secure installer, and a local-first orchestration system — simultaneously. That is not a defensible product position for a solo builder. It is a research agenda disguised as a near-term execution plan.

The project must now be narrowed. Not because the original ideas are wrong, but because executing them all at once guarantees that none of them will ship in a form that can be demonstrated, tested, or compared against anything real.

---

## 2. What the Project Is NOT Anymore

The following framings should be abandoned or explicitly de-emphasized as near-term positioning:

- **"A full Mission Control platform."** Mission Control is a UI surface. Building a dashboard before the data pipeline behind it is proven is backward. The project has already fallen into this trap: 18 React pages exist, most showing empty or manually-populated data.

- **"A complete secure installer + orchestration suite."** The secure-installer shell (Docker management, Safe Mode, Tauri/Rust bootstrap) is functional. But calling it a full orchestration suite when the coordinator is a CRUD wrapper is misleading.

- **"A governed autonomous software organization."** The V2 constitution describes committees, evidence chains, capability registries, five institutional levels, and a full failure taxonomy. None of these exist. This is a legitimate long-term target. It is not a product.

- **"A replacement for OpenClaw."** This is a fork. The upstream project has a team. This fork should position itself as an opinionated layer on top of the execution substrate, not as a competitor to the substrate itself.

- **"A multi-agent orchestration engine."** The CLI runs a single agent per invocation. Multi-agent orchestration requires either spawning and coordinating multiple CLI processes or modifying the agent loop internally. Neither capability exists.

- **"A policy engine / governance system."** The policy UI is mocked. Cost caps are disabled. Security policies are static display. There is no OPA integration, no gate engine, no real enforcement mechanism.

These framings are not cancelled permanently. They remain in the V2 constitution as conceptual targets. But they must not appear in any near-term positioning, sprint scope, or demo claim.

---

## 3. Repo-Grounded Current Reality

### 3.1 Inherited Execution Substrate (System A)

The OpenClaw CLI is a single-agent runner. The desktop app (`runs.rs`, 758 lines) spawns it as a child process via `tokio::process::Command`. The agent loop runs internally, producing stdout/stderr lines. The desktop polls these lines, looks for `[OC_EVENT]` prefixes, and appends raw events to `events.jsonl`. Run metadata lives in filesystem `meta.json` files. State is file-based and ephemeral per run.

**Status: Functional.** This works as an execution primitive. It is not an orchestrator.

### 3.2 Desktop Supervision Layer

A Tauri v2 desktop app (Rust backend + React frontend) with:
- Docker lifecycle management for the gateway container
- Agent management (create, start, stop, quarantine, inspect, stats)
- Chat interface supporting Ollama, LM Studio, OpenAI, Anthropic
- 18 React pages including Missions, MissionDetail, Runs, RunDetail, CreateRun, Activity, Console, Connections, Providers, Policies, Settings
- Embedded PostgreSQL runtime (`runtime_pgsql.rs`) that extracts a bundled PG binary, runs `initdb`, starts `pg_ctl`, and manages the lifecycle
- Safe Mode support for restricted environments

**Status: Structurally functional.** Builds and type-checks. Several pages display mocked or empty data (cost tracking returns `formatCost(0)`, alerts are `MOCK_ALERTS`, security policies are static).

### 3.3 Mission Persistence Layer (System B)

PostgreSQL-backed, with 4 SQL migrations creating:
- `missions` (UUID, title, status, mode, phase, health_state, governance_state, resume_readiness)
- `mission_charters` (intent_raw, constraints, acceptance_criteria, scope)
- `case_files` (summary, next_action, risk_summary, continuity_data)
- `contracts` (type, title, status, health_state, governance_state, assigned_role)
- `artifacts` (type, name, status, promotion_state, storage_path)
- `decision_records`, `validation_records`, `resume_snapshots`
- `mission_state_projections` (enriched with 12+ fields)
- `responsibility_ledger_entries`
- `run_linkages` (run_id → mission_id + contract_id)

12 repository files, 6 service files, 1 coordinator module (`mission_coordinator.rs`, 122 lines), 1 Tauri command module.

**Status: Schema is real. Repositories and services exist. The coordinator is a CRUD pass-through to services — it creates objects and refreshes projections but makes zero autonomous decisions.**

### 3.4 The Bridge — Partial, Not Complete

The architecture feasibility audit (2026-03-18) stated the bridge "does not exist." This was accurate at the time. Since then, Sprint 2+ work added a `reconcile_run_status_core` function in `runs.rs` that:

- Writes `run_linkages` records when a run is created with `mission_id` and `contract_id`
- Updates contract status based on run terminal state (running → active, done → fulfilled, failed → failed, blocked → blocked)
- Writes validation records on terminal states with idempotence checks
- Writes decision records on blocked state
- Creates resume snapshots when runs end
- Refreshes mission state projections after canonical writes
- Discovers workspace artifacts and upserts them to the artifacts table

**Status: A one-directional bridge exists.** Run terminal events flow into mission state objects. However:
- The bridge is located in `runs.rs`, not in the coordinator — the coordinator is bypassed for reconciliation
- The interpretation layer is thin: it maps run statuses to contract statuses mechanically, without judgment
- The coordinator does not decide when to launch runs, which model to use, or how to interpret results — the UI does all of this
- No structured event vocabulary is implemented beyond `[OC_EVENT]` stdout prefix parsing for three event names (`run.started`, `run.completed`, `run.failed`)

### 3.5 Gateway

A Dockerized 308-line Node.js HTTP server (`gateway/openclaw.mjs`) with in-memory stores, serving health, capabilities, agents, events, policies, and connections endpoints. All data is ephemeral. It is not connected to PostgreSQL or the mission model.

**Status: Placeholder.** Functional for health checks and basic API surface. Not a real gateway.

### 3.6 Mocked or Premature Governance Surfaces

- Cost tracking: `formatCost(0)`, no real tracking
- Alerts: `MOCK_ALERTS` array
- Security policies: static UI display with no enforcement
- Responsibility ledger: table exists, written to only on approval resolution events
- Mission modes / governance states: schema fields exist, nothing sets them dynamically based on mission conditions
- Evidence bundles, claims, committees, branching, recovery taxonomy, capability registry: none exist

---

## 4. Strategic Diagnosis After Feedback

### 4.1 Competitive Saturation

The AI agent orchestration space is crowded. Projects like CrewAI, AutoGen, LangGraph, and numerous agent-runner frameworks exist. OpenClaw itself is an active project with a team. Multiple forks and extensions exist. Building "another Mission Control dashboard" or "another agent orchestrator" is inherently undifferentiated.

**Lesson: Generic scope guarantees invisibility.** The project cannot compete on breadth with teams. It must compete on depth in a specific, underserved niche.

### 4.2 Weak Differentiation

The current fork's actual differentiators are:
1. Embedded PostgreSQL on Windows with zero-config bootstrap
2. Tauri/Rust desktop supervisor with local-first architecture
3. Mission persistence schema with canonical state (partially bridged)
4. Safe Mode for restricted environments

The non-differentiators (things others already do, often better):
- LLM provider integration
- Channel routing
- Dashboard UI panels
- Agent lifecycle management
- Docker container orchestration

**Lesson: The differentiators are all in the local-first, persistent, Windows-native substrate.** The non-differentiators are everything else. Strategy should lean into what is genuinely different, not what is generic.

### 4.3 Architecture Narrative vs Executable Architecture

The V2 constitution is 479 lines of French-language systems thinking. It describes a system with institutional hierarchies, transition governance models, evidence chains, branching models, capital opératoire, and committee logic. It is intellectually rigorous. It is also approximately 10× more complex than what exists.

**Lesson: Vision documents are constitutions, not sprint scopes.** The V2 must remain a north star consulted for design consistency. It must never be confused with an implementation plan. Every sprint scope decision should be justified against current repo reality, not against the V2.

### 4.4 Solo-Builder Execution Risk

A single builder cannot simultaneously:
- Maintain a Tauri/Rust desktop app
- Maintain a Node.js gateway
- Build a mission orchestration engine
- Build a governance layer
- Build a policy engine
- Build a multi-agent coordinator
- Compete with multi-person teams on dashboard UX

**Lesson: The project must accept a drastically narrower scope or it will produce nothing shippable.** Narrowing is not failure. Narrowing is the precondition for producing proof.

### 4.5 Why Competitive Intelligence Is Now Mandatory

The project has been designed in relative isolation. Before committing to a wedge, the builder must know:
- What do existing OpenClaw forks and plugins already provide?
- What do adjacent tools (Rivet, Langflow, Flowise, n8n + AI extensions, Windmill) offer for local agent orchestration?
- What is the actual state of Mission Control / canonical state / deterministic resume in those tools?
- Where is the genuine gap?

Without this audit, any wedge choice is a bet made without data.

---

## 5. Competitive Audit Frame

### 5.1 What to Audit

Audit projects in three concentric rings:

**Ring 1 — OpenClaw ecosystem**: Other OpenClaw forks, extensions, and community plugins that add mission-like, dashboard, or install features. Check the OpenClaw GitHub organization, community Discord, and extension registry.

**Ring 2 — Adjacent agent orchestration tools**: CrewAI, AutoGen, LangGraph, Rivet, Langflow, Flowise, n8n (AI nodes), Windmill, Dify. Focus on their local-first story, persistence model, and Windows experience.

**Ring 3 — Desktop AI agent tools**: LM Studio, Ollama (desktop), Jan.ai, GPT4All, AnythingLLM. Focus on their mission persistence, canonical state, and recovery models.

### 5.2 Comparison Matrix

For each project evaluated, capture:

| Dimension | What to Record |
|:---|:---|
| **Repo / product** | Name, URL, license, team size if known |
| **Primary shape** | Agent runner / orchestrator / dashboard / installer / IDE plugin / CLI |
| **Target user** | Developer / operator / non-technical / enterprise |
| **Local-first or not** | Fully local / cloud-required / hybrid |
| **Windows experience** | Native .exe / WSL-dependent / Linux-only / untested |
| **Canonical state model** | In-memory / file-based / SQLite / PostgreSQL / cloud DB |
| **Linked mission/run model** | Runs are standalone / runs link to persistent workflows / no workflow concept |
| **Crash recovery / resume** | None / checkpoint file / DB-backed resume / deterministic replay |
| **Governance / approval model** | None / binary approval / policy engine / role-based / custom |
| **Security posture** | Sandboxed / Safe Mode / allowlists / none explicit |
| **Install complexity** | `npm install` / Docker required / Electron bundle / compiled binary |
| **What is genuinely differentiated** | Free text |
| **What is still weak or missing** | Free text |

### 5.3 Evaluation Method

1. For each Ring 1 project: clone/install, read README, inspect source for persistence model, test on Windows if applicable.
2. For each Ring 2 project: install, complete the "hello world" workflow, evaluate persistence and resume behavior after process kill.
3. For each Ring 3 project: install on Windows, verify local-first operation, check if any canonical state survives restarts.

### 5.4 Decision Criteria

After the audit, the wedge is defensible if and only if:
- At least one dimension of the comparison matrix shows this project in a position that **no audited competitor occupies**
- That dimension is **valued by a real user segment** (not theoretically interesting but practically irrelevant)
- That dimension is **achievable within the current repo state** (not requiring 6 months of new architecture)

If no such dimension is found, the project should either pivot to a different wedge or seriously consider contributing upstream rather than maintaining a fork.

---

## 6. Proposed Wedge Options

### Wedge A: Mission Continuity Engine for Local Agent Operations

**One sentence**: A persistence and deterministic resume layer that makes local AI agent runs recoverable, resumable, and auditable across process crashes, restarts, and session boundaries.

**Why defensible**: Most agent runners treat runs as ephemeral. When a process dies, state is lost. The combination of embedded PostgreSQL, canonical state schema, bridge-based reconciliation, and resume snapshots is genuinely rare. No major agent framework provides deterministic resume from canonical DB state on Windows as a core feature.

**Why it matches the repo**: The schema exists. The PG runtime works. The bridge (partial) exists. Resume snapshots are written. The types are defined. The infrastructure investment is already pointed here.

**What it excludes**: Full Mission Control dashboards, multi-agent orchestration, governance engines, policy enforcement, evidence bundles, committees, branching, channel routing, and broad UI expansion.

**Execution risk**: Medium. The bridge is partial but real. The main risk is that the OpenClaw CLI event vocabulary is too opaque to build reliable interpretation on, and that resume from canonical state requires more agent-loop cooperation than the CLI currently provides.

---

### Wedge B: Zero-Config Windows Desktop for Local AI Agent Management

**One sentence**: A single-binary Windows desktop app that manages local AI agents (Ollama, LM Studio) with Docker isolation, without requiring command-line, WSL, or cloud services.

**Why defensible**: The Windows AI tooling experience is poor. Most agent frameworks assume Linux/macOS, require WSL, or depend on cloud APIs. A native .exe with embedded PG, Docker management, and Safe Mode is underserved.

**Why it matches the repo**: Tauri builds to .exe. PG runtime works on Windows. Docker management is implemented. Safe Mode exists. The desktop app is functional.

**What it excludes**: Mission orchestration, governance, canonical state claims, multi-run mission linking, and anything that requires the bridge to work end-to-end.

**Execution risk**: Low for the installer shell. High for differentiation — the value over LM Studio / Jan.ai / AnythingLLM must be clearly demonstrated, and those tools have larger teams.

---

### Wedge C: Bridge-First Canonical State for OpenClaw Forks

**One sentence**: A reusable canonical state module (PostgreSQL-backed mission persistence, run linkage, event reconciliation, projection) that any OpenClaw fork or deployment can embed for persistent, auditable agent operations.

**Why defensible**: This positions the project as infrastructure rather than end-user product. If the canonical state module is clean, tested, and documented, it could become a library consumed by other forks or by upstream.

**Why it matches the repo**: The schema, repositories, services, and partial bridge already exist. The work would involve completing the bridge, hardening the reconciliation, and packaging it as a reusable module.

**What it excludes**: Desktop UI, installer experience, gateway management, and end-user-facing features. This is a developer-facing infrastructure wedge.

**Execution risk**: High. Library-as-product requires adoption. A solo builder producing a library that nobody uses is a common failure mode. This wedge only works if it gains traction with other OpenClaw fork maintainers or gets considered for upstream inclusion.

---

### Recommended Wedge

**Wedge A — Mission Continuity Engine.**

Rationale:

1. It leverages the existing infrastructure investment (PG runtime, schema, partial bridge, resume snapshots) rather than discarding it.
2. It targets a genuinely underserved capability (deterministic resume from canonical state on local-first agent operations).
3. It is narrow enough to be provable with a single vertical slice by a solo builder.
4. It is architecturally honest: the bridge is the hard problem, and this wedge makes the bridge the product core rather than hiding it behind a dashboard.
5. It preserves optionality: once mission continuity works, Mission Control dashboards, governance layers, and multi-agent orchestration can be layered on top incrementally.
6. It becomes genuinely uninteresting to generic dashboard builders but genuinely valuable to users who need reliable, persistent agent operations.

**Assumption**: This recommendation is contingent on the competitive audit (Section 5) confirming that no existing tool already provides comparable canonical-state-backed mission continuity for local agent operations. If the audit reveals this gap is already filled, the wedge must be reconsidered.

---

## 7. Final Recommended Positioning

> **OpenClaw Secure Installer** is a Windows-native desktop runtime for persistent, recoverable AI agent operations.
>
> It embeds PostgreSQL as a canonical state store, bridges OpenClaw CLI execution events into structured mission state, and provides deterministic resume of agent work across process crashes, restarts, and session boundaries.
>
> It is not a Mission Control dashboard. It is not a multi-agent orchestrator. It is not a governance engine.
>
> It is the persistence and continuity layer that makes local AI agents reliable.

This positioning:
- Avoids overlapping with "Mission Control dashboard" claims
- Avoids overlapping with upstream OpenClaw's scope (channels, routing, gateway)
- Is technically grounded in what exists (PG runtime, schema, partial bridge)
- Is narrow enough to be provable
- Is broad enough to grow from

---

## 8. Architectural Consequence of the Wedge

### 8.1 What Stays as Substrate

- **OpenClaw CLI**: remains the execution primitive. Do not modify the agent loop. Use it as a black box that accepts prompts and produces stdout/events.
- **Docker management**: remains as the isolation layer for gateway and agents.
- **Tauri desktop shell**: remains as the runtime host for PG, the coordinator, and the UI surface.
- **React pages**: stay as-is. Do not build new pages. The existing pages are sufficient for proof.

### 8.2 What Becomes the Actual Product Core

- **The bridge** (`reconcile_run_status_core` and its growth): This is the product. The interpretation of CLI events into canonical mission state is the core intelligence.
- **The canonical state schema**: The PostgreSQL tables, their states and transitions, and the projection service.
- **The resume mechanism**: Resume snapshots, resume readiness evaluation, and the ability to reconstruct mission state from the canonical store after process death.
- **Embedded PG runtime**: The zero-config PostgreSQL lifecycle on Windows.

### 8.3 What Is Postponed

- Multi-agent orchestration (requires agent-loop modification or multi-process coordination)
- Governance engine / policy enforcement (requires bridge maturity first)
- Evidence bundles, claims, counter-evidence (no evidence model exists)
- Branching / concurrent trajectories (no branching support)
- Committee / deliberation model (not implementable at current stage)
- Capital opératoire / learning system (future maturity layer)
- Coordinator elevation to orchestration authority (requires bridge maturity, event vocabulary expansion, and decision logic)
- New UI pages or significant UI expansion (data flow must exist first)
- Gateway evolution beyond health endpoint (the Node server stays minimal)
- Channel routing, extension exposure, multi-channel pairing (upstream concerns)

### 8.4 Why the Bridge Matters More Than New UI or Governance

The bridge is currently the only mechanism that connects CLI execution to mission persistence. Without it:
- Mission Control pages show empty or stale data
- Resume snapshots have no meaningful state to capture
- Canonical state is a set of empty tables
- The coordinator is a database accessor with no information flow

Every downstream capability (governance, evidence, recovery, dashboards) depends on the bridge existing and being reliable. Building those capabilities before the bridge is proven is building on air.

---

## 9. Non-Negotiable Near-Term Build Doctrine

The following rules are operating constraints. They are not suggestions.

1. **Bridge first.** No feature work that does not directly improve the reliability, coverage, or correctness of the run → mission state bridge.

2. **No new governance layers before real mission/run linkage is proven end-to-end.** The policy UI is mocked. Leave it mocked. Do not build a policy engine until one working mission can be created, linked to a run, and have its state coherently updated and resumed.

3. **No broad UI expansion before the data flow exists.** The 18 existing React pages are sufficient. Do not add new pages, panels, or dashboards. Fix the data that feeds existing pages.

4. **V2 remains north star, not sprint scope.** The V2 constitution is a 479-line document in French describing a system with institutional hierarchies, transition governance, evidence chains, and mission modes. It is correct as a design reference. It is not a near-term build target.

5. **No speculative branching, committee, or evidence systems yet.** These are layers 3-5 of a building whose layer 2 (the bridge) is partially built and unproven in runtime.

6. **One working vertical slice beats many disconnected panels.** A single demo where a mission is created, a run executes, canonical state updates, and the state survives restart is worth more than 10 new specs or 5 new UI components.

7. **The coordinator must be on the reconciliation path.** Currently, `reconcile_run_status_core` in `runs.rs` bypasses the coordinator entirely. The coordinator should own or at minimum participate in reconciliation. This is not about ceremony — it is about establishing a single authority for state truth.

8. **No complexity additions until Sprint 7 proof is complete.** Sprint 7 defines the truth table: linked run succeeds, fails, is cancelled; restart safety; idempotence. These must pass before any new capability is attempted.

9. **Accept that the coordinator is currently a CRUD wrapper and name it honestly.** Do not call it an "orchestration authority" until it makes at least one autonomous decision (e.g., choosing a model, deciding whether to retry, interpreting a failure type).

10. **If the CLI event vocabulary is too opaque, stop and assess.** The entire bridge depends on reliably interpreting `[OC_EVENT]` prefixes and exit codes. If the CLI does not emit enough structured information for the bridge to work, the wedge may require upstream contribution — and that is a strategic decision, not a bug fix.

---

## 10. The Single Vertical Slice to Prove

### 10.1 User Flow

1. User opens the desktop app.
2. App bootstraps embedded PostgreSQL (already works).
3. User navigates to Missions, clicks "Create Mission."
4. User enters a title and intent. Mission is created with a charter.
5. User admits a contract (e.g., type "execution", title "Implement feature X").
6. User launches a linked run from the mission/contract context (via CreateRun or MissionDetail).
7. The OpenClaw CLI agent executes against the workspace.
8. User observes in MissionDetail: contract status changes from "pending" → "active" → "fulfilled" (or "failed").
9. User sees a validation record in the mission feed.
10. User sees discovered artifacts listed.
11. User closes the app entirely.
12. User reopens the app.
13. Mission, contracts, artifacts, records, and projection are all intact — read from PostgreSQL.
14. Resume readiness is true. User could theoretically continue.

### 10.2 Backend Flow

1. `create_mission` → MissionCoordinator → MissionService → PostgreSQL `missions` + `mission_charters`
2. `admit_contract` → MissionCoordinator → ContractService → PostgreSQL `contracts`
3. `create_run` with `mission_id` + `contract_id` → `runs.rs` → writes `run_linkages` in PG, writes `meta.json` on disk
4. `start_run` → spawns CLI process → streams stdout/stderr → parses `[OC_EVENT]` lines
5. On terminal state → `reconcile_run_status_core`:
   - Updates `run_linkages.status`
   - Updates `contracts.status`
   - Writes `validation_records` (with idempotence check)
   - Discovers workspace artifacts → `artifacts` table
   - Creates `resume_snapshots`
   - Refreshes `mission_state_projections`
6. Emits `mission-projection-updated` to frontend

### 10.3 Data Flow

```
CLI stdout → [OC_EVENT] parsing → RunStatus enum
    ↓
reconcile_run_status_core(pool, run_id, status)
    ↓
┌─ run_linkages.status update
├─ contracts.status update
├─ validation_records insert (idempotent)
├─ decision_records insert (on blocked)
├─ artifacts upsert (discovered)
├─ resume_snapshots insert
└─ mission_state_projections.refresh()
    ↓
Tauri event → React MissionDetail re-render
```

### 10.4 Minimum Schema Touchpoints

Tables that must receive real data during the slice: `missions`, `mission_charters`, `contracts`, `run_linkages`, `validation_records`, `artifacts`, `resume_snapshots`, `mission_state_projections`.

Tables that may receive data: `decision_records` (on blocked), `responsibility_ledger_entries` (on approval resolution), `case_files`.

### 10.5 Minimum UI Proof

- MissionDetail page shows: mission header, contract list with status, linked run with status, validation feed, artifact list, projection summary.
- After restart: same data visible, read from PG.

No new pages needed. No new components needed. The existing MissionDetail page must be fed by real data.

### 10.6 What "Done" Means

The slice is done when:

1. A mission + contract + linked run can be created through the UI.
2. The run completes (success or failure) and canonical state is updated automatically.
3. MissionDetail displays the updated state without manual refresh.
4. After full app restart, all state is preserved and readable.
5. Repeated terminal event observation does not create duplicate records.
6. Sprint 7 truth table scenarios (success, failure, cancellation, restart, duplicate replay) all pass.

### 10.7 What Does NOT Need to Exist Yet

- Multi-agent runs
- Governed branching
- Evidence bundles
- Policy enforcement
- Real-time streaming of agent reasoning
- Cost tracking
- Alert system
- Committee logic
- Recovery taxonomy beyond "retry from UI"
- Coordinator autonomous decision-making

---

## 11. Immediate Execution Plan

### Phase 1: Competitive Audit (1 week)

**Input**: The audit framework from Section 5, plus publicly available information on Ring 1-3 projects.

**Activities**:
- Identify all OpenClaw forks and extensions that touch mission, persistence, or dashboard features.
- Evaluate 3-5 Ring 2 tools (CrewAI, LangGraph, Flowise, n8n, Windmill) on the comparison matrix.
- Evaluate 2-3 Ring 3 tools (LM Studio, Jan.ai, AnythingLLM) for local-first persistence.
- Document findings in a `docs/competitive_audit.md` file.

**Output**: Completed comparison matrix. Written assessment of whether Wedge A is defensible.

**Exit criteria**: A clear yes/no answer to: "Does any existing tool provide canonical-state-backed mission continuity for local agent operations on Windows?" If yes, reassess the wedge. If no, proceed.

---

### Phase 2: Wedge Decision (1-2 days)

**Input**: Audit results, this document, professor's feedback.

**Activities**:
- Review audit against wedge options.
- Confirm or modify the recommended wedge.
- Write a one-paragraph wedge statement that can be used as an internal reference.
- If the wedge is not defensible, define an alternative based on audit findings.

**Output**: Final wedge decision documented in a `docs/wedge_decision.md` file.

**Exit criteria**: A written commitment to one wedge with explicit justification.

---

### Phase 3: Vertical Slice Implementation (2-3 weeks)

**Input**: Wedge decision, Section 10 vertical slice spec.

**Activities**:
- Complete Sprint 7 truth table scenarios if not already done.
- Harden the bridge: ensure reconciliation is idempotent, contract transitions are legal, artifacts are not duplicated.
- Move reconciliation logic into or through the coordinator (not bypassing it in `runs.rs`).
- Verify MissionDetail page displays real data from all bridged tables.
- Test restart safety: close app, reopen, verify state integrity.
- Test failure paths: forced run failure, cancellation, blocked state.

**Output**: Working vertical slice demonstrable on a fresh Windows machine.

**Exit criteria**: All 6 conditions from Section 10.6 are met. A recorded demo or screenshot series can be produced.

---

### Phase 4: Validation / Demo (2-3 days)

**Input**: Working vertical slice.

**Activities**:
- Produce a proof document (`docs/vertical_slice_proof.md`) with commands executed, flows tested, state observations, restart observations, and remaining gaps.
- Run the architecture feasibility audit prompt against the updated repo.
- Run the adversarial feedback prompt against the claimed result.
- If both prompts confirm the proof, the phase is complete.

**Output**: Proof document. Honest assessment of what works and what does not.

**Exit criteria**: The proof document can survive adversarial challenge. If it cannot, the slice is not done.

---

## 12. Contribution Strategy vs Pure Fork Strategy

### When to Contribute Upstream

- **If the bridge requires CLI changes.** The event vocabulary emitted by the OpenClaw CLI (`[OC_EVENT]` prefixes) is currently limited to three events. If the bridge needs richer structured events (tool calls, completion reasons, error classifications, artifact creation signals), the correct path is to contribute an event schema to upstream OpenClaw rather than patching the CLI locally. A local patch will break on every upstream merge.

- **If the canonical state module proves generic.** If the PostgreSQL persistence layer (schema, repositories, reconciliation) turns out to be useful for any OpenClaw deployment, it should be proposed as an upstream plugin or extension. This converts the fork's differentiation into ecosystem contribution, which is strategically stronger than maintaining a private fork.

- **If Safe Mode improvements are generic.** Safe Mode is already defined in upstream OpenClaw. If this fork improves it, those improvements should go upstream.

### When to Stay a Fork

- **If the wedge requires architectural decisions that diverge from upstream.** Embedded PostgreSQL, Tauri-based desktop supervisor, and mission persistence are not part of upstream OpenClaw's architecture. These are fork-specific choices. As long as the fork maintains compatibility with the upstream CLI, keeping these as fork-specific is correct.

- **If the upstream project does not accept the contribution.** Contribution is a proposal, not an entitlement. If upstream declines, the fork proceeds independently.

### What to Learn First from Other Codebases

Before contributing or forking further, study:

1. **How upstream OpenClaw emits events internally.** Read the agent loop code. Understand the event vocabulary. Determine what structured signals are already available but not exposed as `[OC_EVENT]`.

2. **How other agent frameworks handle persistence.** CrewAI's memory system, LangGraph's checkpointing, AutoGen's message store. Understand what patterns exist for canonical state in agent systems.

3. **How Tauri projects handle embedded databases at scale.** Study Obsidian (SQLite), Joplin, Standard Notes. Understand the failure modes of bundled database runtimes on Windows.

---

## 13. Risks and Kill Criteria

### Risk 1: Wedge Not Differentiated After Audit

**Condition**: The competitive audit reveals that an existing tool already provides canonical-state-backed mission continuity for local agent operations.

**Response**: Reassess wedge. Consider Wedge B (Windows desktop UX) or Wedge C (infrastructure module). If no defensible wedge exists, consider contributing to the most promising existing project rather than maintaining a fork.

### Risk 2: Bridge Too Opaque Relative to Event Vocabulary

**Condition**: The OpenClaw CLI does not emit enough structured information for the bridge to reliably interpret execution state. The bridge produces incorrect or incomplete canonical state.

**Response**: This is the highest technical risk. If the CLI event vocabulary is insufficient:
- Option 1: Contribute a richer event schema to upstream OpenClaw.
- Option 2: Wrap the CLI in a process supervisor that adds structured event parsing.
- Option 3: Accept that the bridge can only handle terminal states (success/failure/cancelled) and scope the wedge accordingly.

If none of these options produce a reliable bridge, the wedge is not viable as currently defined.

### Risk 3: Windows / Local-First Not Materially Better Than Existing Tools

**Condition**: LM Studio, Jan.ai, or AnythingLLM already provide a comparable or superior Windows-native AI agent experience. The fork's Tauri desktop adds insufficient value over these tools.

**Response**: If the desktop UX wedge is not differentiated, the project must differentiate on the persistence and continuity layer exclusively. If that is also not differentiated, the fork has no defensible position.

### Risk 4: No Working Vertical Slice After Fixed Effort Budget

**Condition**: After 3 weeks of Phase 3 work, the vertical slice does not pass all 6 conditions from Section 10.6.

**Response**: Diagnose the failure. If the failure is in the bridge (reconciliation unreliable, CLI events insufficient), the wedge requires more foundational work. If the failure is in PG runtime or Tauri stability, the platform choice may need reconsideration. In either case, do not proceed to Phase 4 or claim proof that does not exist.

### Risk 5: Solo Builder Burnout or Scope Creep

**Condition**: The builder starts adding features outside the wedge scope (new dashboards, governance layers, multi-agent routing) before the vertical slice is proven.

**Response**: Re-read Section 9 (Build Doctrine). If the doctrine is being violated, stop and return to the vertical slice. Features added before proof exist are liabilities, not assets.

### Kill Criteria

The project should be stopped, pivoted, or sharply reduced in scope if any of the following are true after completing Phases 1-4:

1. The competitive audit shows the wedge is already occupied by a project with more resources and a better implementation.
2. The bridge cannot be made reliable due to CLI opacity, and upstream will not accept event vocabulary contributions.
3. The vertical slice cannot be completed in 3 weeks.
4. After completing the vertical slice, no demonstrable user would prefer this tool over existing alternatives for any specific task.

---

## 14. Final Operating Statement

**What the project is now**:
A Windows-native desktop runtime for persistent, recoverable AI agent operations. Built on top of the OpenClaw execution substrate. Differentiated by embedded PostgreSQL canonical state, bridge-based run-to-mission reconciliation, and deterministic resume.

**What it is not**:
A full Mission Control platform. A multi-agent orchestrator. A governance engine. A competitor to upstream OpenClaw. A product described by the V2 constitution.

**What proof matters next**:
One working vertical slice where a mission is created, a linked run executes, canonical state is updated, the state survives restart, and the result can be shown to an external observer without embarrassment.

**What must be ignored for the moment**:
Evidence bundles. Committees. Branching. Multi-agent routing. Policy enforcement. Capital opératoire. New UI pages. Gateway evolution. Channel expansion. Everything in the V2 constitution that is more than two architectural layers above the current bridge.

The bridge is the product. Prove the bridge. Everything else follows or doesn't matter.
