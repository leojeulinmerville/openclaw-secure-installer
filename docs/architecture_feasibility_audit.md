# Architecture & Product Feasibility Audit

> **Scope**: OpenClaw fork → governed autonomous production system.
> **Method**: All 15 specified documents read + actual source code verified.
> **Date**: 2026-03-18

---

## 1. Executive Verdict

Your target product is **not currently buildable** by simply incrementing the existing repo. You have two separate systems coexisting in one codebase: a **run-centric execution engine** (OpenClaw CLI, [runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs), `events.jsonl`, `state.json`) and a **nascent mission persistence layer** (PostgreSQL, repositories, services, coordinator, Mission UI). These two systems **are not connected**. [runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs) contains zero references to missions. The CLI knows nothing about contracts, case files, or projections.

Your vision document ([product_system_v2.md](file:///d:/MVP/openclaw-secure-installer/docs/product_system_v2.md)) describes a system that is approximately **10× more complex** than what exists today, and approximately **5× more complex** than what your MVP specs describe. The gap is not incremental — it is structural. The run engine is a process-spawning wrapper. Your vision requires a persistent mission daemon with orchestration authority, evidence governance, branching, recovery, and multi-agent routing. These are not the same system.

**However**, the foundation you have built in Sprints 0–2 is real and correct in direction. PostgreSQL bootstrap works. The schema exists. The coordinator API exists. The Mission UI pages exist. What is missing is the **bridge** — the thing that makes a run's execution feed back into mission state. Without this bridge, your two systems are parallel universes.

---

## 2. What the Repo Really Is Today

### Two Disconnected Systems

**System A — the Run Engine (inherited from OpenClaw):**
- Desktop app ([runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs)) spawns the `openclaw` CLI as a child process
- CLI runs an agent loop internally, producing `events.jsonl` output
- Desktop polls events to update the UI
- State lives in `state.json` (filesystem) and per-run `meta.json` + `events.jsonl`
- No mission awareness, no persistent lifecycle, no structured recovery

**System B — the Mission Persistence Layer (your build):**
- PostgreSQL bootstrapped natively via [runtime_pgsql.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runtime_pgsql.rs) (extract ZIP → initdb → pg_ctl → SQLx pool)
- 4 SQL migrations creating tables for missions, charters, case files, contracts, artifacts, decision/validation records, projections, resume snapshots, responsibility ledger, run linkages
- 12 repository files, 6 service files, 1 coordinator module, 1 Tauri command module (9 commands)
- 2 React pages ([Missions.tsx](file:///d:/MVP/openclaw-secure-installer/desktop/src/pages/Missions.tsx), [MissionDetail.tsx](file:///d:/MVP/openclaw-secure-installer/desktop/src/pages/MissionDetail.tsx)) calling these Tauri commands
- All commands registered in [main.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/main.rs) ✓

**The bridge between them does not exist.** [runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs) has zero references to mission_id, contract_id, or any PostgreSQL table. The `run_linkages` table exists in the schema but nothing writes to it. The mission coordinator can create/pause/resume missions — but no run ever feeds events into it.

### Other Structural Realities
- **Gateway**: a Dockerized Node.js/Hono HTTP server loaded with extensions (channels, providers, plugins). It has its own capabilities API. The Desktop manages it via Docker Compose but does not map its full surface
- **Extensions**: ~15+ extensions in `extensions/` (msteams, matrix, zalo, nostr, voice-call, qwen-portal-auth, open-prose...) — most are not exposed in Desktop
- **Mocked UI**: cost tracking returns `formatCost(0)`, alerts are `MOCK_ALERTS`, security policies are static display, cost caps are disabled
- **LLM providers**: Ollama, LM Studio, OpenAI, Anthropic are wired in [chat.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/chat.rs) — functional but not routing/selecting by role

---

## 3. Where Your Vision Matches the Repo

| Vision Concept | Repo Reality |
|:---|:---|
| **PostgreSQL as canonical source of truth** | ✅ Fully wired: runtime bootstrap, SQLx pool, migrations, health checks |
| **Mission as persistent object** | ✅ [missions](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/mission_coordinator.rs#38-41) table exists, CRUD via coordinator + Tauri commands |
| **Case File, Charter, Contracts, Artifacts** | ✅ Schema exists with all minimal fields from spec_case_file |
| **Decision Records, Validation Records** | ✅ Tables and repositories exist |
| **Mission State Projection** | ✅ Table and projection service exist |
| **Resume Snapshots** | ✅ Table and service exist |
| **Zero-config Windows .exe with embedded PG** | ✅ [runtime_pgsql.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runtime_pgsql.rs) handles the full lifecycle |
| **Tauri/Rust runtime supervisor** | ✅ Working bootstrap chain in [main.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/main.rs) |
| **Desktop as no-code surface** | ✅ Exists but with significant gaps |
| **Docker for execution isolation** | ✅ Gateway in Docker, agents in containers |

These are real. They are the correct foundation. They are not mocked.

---

## 4. Where Your Vision Exceeds the Repo

| Vision Concept | Repo Reality | Gap Severity |
|:---|:---|:---|
| **Run-to-mission bridge** | [runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs) has 0 references to missions | 🔴 Critical |
| **Mission Coordinator as orchestration authority** | Coordinator is a CRUD wrapper, not an orchestrator | 🔴 Critical |
| **Evidence Bundles / Claims** | No evidence model exists | 🟡 Major |
| **Failure Taxonomy** | Runs end as "failed" — no classification | 🟡 Major |
| **Recovery Model** | No recovery logic exists | 🟡 Major |
| **Branching / concurrent trajectories** | No branching support | 🟡 Major |
| **Multi-model routing by role** | Single model per run, no role-based routing | 🟡 Major |
| **Sub-agent orchestration** | CLI runs one agent — no multi-agent coordination | 🔴 Critical |
| **Mission modes / governance states** | Fields exist in schema but nothing sets them dynamically | 🟡 Major |
| **Policy enforcement (real)** | UI is static/mocked, no policy engine | 🟡 Major |
| **Capability Registry with lifecycle** | Extensions loaded statically from folder | 🟡 Major |
| **Intervention Resolution Protocol** | Approval is a binary yes/no | 🟡 Major |
| **5-level institutional hierarchy** | Flat — one agent does everything | 🔴 Critical |
| **Committee / deliberation model** | Does not exist | ⚪ Future |
| **Capital opératoire / learning** | Does not exist | ⚪ Future |
| **Responsibility ledger** | Table exists, nothing writes to it | 🟡 Major |
| **Transition governance (gates)** | `if decision == "approved"` — that's it | 🟡 Major |

---

## 5. Why the Current Dev Experience Feels Opaque

Your opacity feeling has **five concrete, verifiable causes**:

### 5.1 Two Systems, No Bridge
You see a Missions tab that exists and a Runs tab that works, but they don't talk to each other. Creating a mission does nothing to a run. Running a run does nothing to a mission. This creates a split-brain UX where neither view tells you the full truth.

### 5.2 The Run Is a Black Box
When you start a run, the Desktop spawns a CLI process and reads `events.jsonl`. The events are raw, unstructured, append-only logs. There is no structured representation of *what the agent is doing*, *why*, *what it decided*, or *what it produced*. You see a stream of text events — that's the total observability surface.

### 5.3 No State Projection From Execution
The `MissionStateProjection` table exists but is only updated by manual coordinator calls (pause/resume/refresh). Nothing automatically feeds execution state into it. So Mission Control's projection is either empty or stale.

### 5.4 Gateway Capability Surface ≠ Desktop Surface
The Gateway loads 15+ extensions, supports multiple channels, and exposes a `/api/v1/capabilities` endpoint. The Desktop UI exposes WhatsApp, Ollama, and basic LLM providers. The rest is invisible. You sense there's more capability than you can see — because there is.

### 5.5 Mocked UI Creates False Signals
Cost tracking, alerts, security policies, and cost caps all appear in the UI but return hardcoded empty/zero values. This creates a dissonance where the interface promises governance that doesn't exist yet.

---

## 6. Feasibility Verdict by Domain

| Domain | Verdict | Explanation |
|:---|:---|:---|
| **Mission orchestration** | **Requires bridge, then incremental** | Schema is ready. Coordinator exists as CRUD. The critical missing piece is the run-to-mission bridge: making CLI execution feed events into contracts/artifacts/records. This is Sprint 2's unfinished promise. Once bridged, incremental improvement is feasible. |
| **Sub-agents** | **Requires architectural addition** | The CLI spawns a single agent. Multi-agent means either (a) spawning multiple CLI processes coordinated by the Mission Coordinator, or (b) modifying the agent loop internally. Neither exists. This is not a tweak — it's a new capability layer. |
| **Local model strategy** | **Feasible with incremental work** | Ollama integration works. LM Studio works. Adding role-based model selection (planner → large model, coder → code model) is incremental on [chat.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/chat.rs). |
| **Provider/channel setup** | **Feasible with incremental work** | The Gateway loads extensions. What's needed is a Desktop UI that exposes the full connection surface generically (which was started in conversation `1aff462f`'s channel API refactoring). |
| **MCP / Skills** | **Feasible with incremental work** | The `skills/` folder exists. MCP support is present in upstream OpenClaw. Exposure and lifecycle governance are incremental. |
| **Mission Control** | **Requires bridge first** | The UI pages exist. The projection table exists. But without execution data flowing into it, Mission Control shows an empty or manually-populated view. Once the bridge exists, the MVP spec is achievable. |
| **Observability** | **Requires architectural addition** | `events.jsonl` is not a sufficient observability substrate. You need structured events flowing into the mission data model. This is the same bridge problem viewed from the observability angle. |
| **Governance / Policies** | **Not worth forcing on current base yet** | The policy UI is mocked. A real policy engine needs the bridge, the coordinator-as-authority, and either OPA or a custom gate system. This is Phase 3 work in your roadmap. Don't force it before the bridge exists. |

---

## 7. Correct Architectural Recommendation

### Primary Path: **Stronger coordinator/daemon center of gravity** (Hybrid)

Not a major redesign. Not pure incremental. The right path is:

1. **Complete the bridge** — make [runs.rs](file:///d:/MVP/openclaw-secure-installer/desktop/src-tauri/src/runs.rs) emit structured events to the Mission Coordinator when a run starts (link to mission_id + contract_id), during execution (key events → records), and on completion (artifacts, validation, status). This is Sprint 2's unfinished core deliverable.

2. **Elevate the coordinator from CRUD to authority** — the coordinator must become the component that *decides* when to launch a run, which model to use, and how to interpret the result. Right now the Desktop UI is the orchestrator (user clicks "start run"). The coordinator should be.

3. **Keep the run engine as execution substrate** — the CLI and its agent loop are fine as an execution primitive. Don't rewrite them. Use them as the "activation" layer that the coordinator controls.

4. **Do not build a distributed daemon yet** — your specs correctly identified "Embedded Hybrid" as the right model. The coordinator lives in the Rust/Tauri process, talks to PostgreSQL, and spawns CLI processes. This is correct for your current stage. A separate daemon is premature.

### Why not pure incremental?
Because without elevating the coordinator to orchestration authority, you will keep building features on top of two disconnected systems. Every new feature will have to independently solve the "where does the truth live?" problem.

### Why not major redesign?
Because the schema, the PG runtime, the coordinator structure, and the UI pages are all pointed in the right direction. The missing piece is a bridge, not a new architecture.

---

## 8. What Should Stay Desktop-Direct vs Gateway-Native

| Desktop-Direct (Tauri commands → PG/local) | Gateway-Native (HTTP API → Docker) |
|:---|:---|
| Mission lifecycle CRUD | LLM inference (provider calls) |
| Case File reads/writes | Channel message routing |
| Contract management | Extension loading & capability discovery |
| Decision/Validation records | Agent sandbox execution |
| Mission State Projection | MCP/tool execution in sandboxed containers |
| Resume/Pause/Refresh | Webhook endpoints |
| PG runtime management | Multi-channel pairing |
| Run lifecycle (start/stop/link) | |

**Rule of thumb**: anything that touches the mission data model should go through the Tauri/Rust coordinator. Anything that touches external services, sandboxed execution, or multi-channel communication should go through the Gateway.

---

## 9. Immediate Next Move After Sprint 3

**Build the run-to-mission bridge.**

Concretely:

1. Modify `runs.rs::start_run` to accept an optional `mission_id` and `contract_id`. When provided, write a `run_linkages` record.

2. At key execution events (tool call, completion, error), emit structured updates to the mission coordinator: update contract status, create artifact records, write decision/validation records.

3. Modify [Missions.tsx](file:///d:/MVP/openclaw-secure-installer/desktop/src/pages/Missions.tsx) / [MissionDetail.tsx](file:///d:/MVP/openclaw-secure-installer/desktop/src/pages/MissionDetail.tsx) to show linked runs, active contracts, and recent records — reading from the projection service.

4. This single change connects your two systems and makes Mission Control real. Everything else (evidence model, recovery, branching, multi-agent) becomes incrementally buildable on top of this bridge.

**Do not** start Sprint 4 governance, branching, or evidence work before this bridge exists. It would be building a second floor on a house with no stairs.

---

## 10. Brutal Truth

### What you are overestimating

- **The coordinator's current capability.** It is a CRUD service, not an orchestrator. It can create and retrieve objects but it makes zero decisions, launches zero processes, and interprets zero events. Calling it a "Mission Coordinator" is aspirational. Right now it is a mission database accessor.

- **The proximity of your vision to the current repo.** Your [product_system_v2.md](file:///d:/MVP/openclaw-secure-installer/docs/product_system_v2.md) describes a system with 30+ named roles, 5 hierarchical levels, 10 mission phases, evidence chains, committees, branching, recovery taxonomies, capital opératoire governance, and a full transition governance model. Your repo has two disconnected CRUD systems and a CLI wrapper. The conceptual distance is enormous. This is not a criticism of the plan — it is a warning about timeline and expectations.

- **The value of the spec documents without execution proof.** You have 3 excellent specs (case file, coordinator, Mission Control) but they describe a system that does not yet exist end-to-end. The specs are the map, not the territory. The territory is: "can you create a mission, run an agent on it, and see the result in Mission Control?" The answer today is no.

### What you are underestimating

- **The difficulty of the bridge.** The bridge is not just "pass mission_id to the run." It requires interpreting raw CLI events (stdout, tool calls, completions, errors) and mapping them to structured mission objects (contracts, artifacts, decisions, validations). This interpretation layer is the actual orchestrator intelligence — and it doesn't exist yet.

- **The run engine's opacity.** The CLI's agent loop is not easily introspectable. It produces `events.jsonl` with raw event objects. Turning these into meaningful mission state updates requires understanding the agent's internal event vocabulary and building a reliable mapper. This is non-trivial.

### What you are probably misreading

- **The "task" and "mission" tabs.** You said things "loop" and the behavior is hard to reason about. This is because Runs and Missions are separate systems with no shared state. A run doesn't know it's part of a mission. A mission doesn't know a run is happening. The opacity isn't a UX bug — it's a data architecture disconnect.

- **OpenClaw's nature.** OpenClaw is a **single-agent runner with channel routing and tool access**. It is excellent at: taking a prompt, running an agent loop with tool calls, and streaming results through channels. It is not designed for: persistent multi-run missions, multi-agent orchestration, governed trajectories, or evidence-based decision making. Your fork correctly identifies it as an "execution substrate" — but you must genuinely treat it as substrate, not as a system that is "almost" your target product.

### What you should stop doing

- Stop treating [product_system_v2.md](file:///d:/MVP/openclaw-secure-installer/docs/product_system_v2.md) as a near-term implementation guide. It is a constitution for a system that will take 12–18 months to fully realize. Use it as a north star for design decisions, not as a Sprint 4 scope document.

- Stop building new UI features without the bridge. Every new Mission Control panel you build before runs feed into missions will be a panel showing empty data.

- Stop planning governance, evidence, and branching before the basic mission lifecycle works end-to-end. These are layers 3–5 of a building whose layer 2 (the bridge) does not exist yet.

### What you should start doing

- **Bridge first, then everything else.** One working demo where you create a mission, start a linked run, and see the contract status update in Mission Control — this is worth more than 10 new specs.

- **Treat the coordinator as a real authority.** Refactor to have the coordinator decide when and how to start a run, not the UI directly. This is the single biggest architectural shift that makes everything else possible.

- **Accept a smaller, working vertical slice** over a broad, disconnected horizontal surface. A system that can run one mission end-to-end with real state tracking is infinitely more valuable than one that has 6 UI panels, 3 specs, and no working pipeline.
