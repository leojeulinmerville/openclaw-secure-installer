# OpenClaw Architecture Mapping: V2 Alignment Analysis

This document maps the **V2 Product Vision** (autonomous governed orchestration) to the **actual OpenClaw + Desktop** architecture. It identifies what can be reused, what must be adapted, and what requires a new build.

---

## 1. Executive Summary

1.  **Execution Engine (Reuse):** OpenClaw remains the primary execution substrate. We do **not** rebuild the agent runtime, tool execution, or low-level sandboxing.
2.  **Permissions (Reuse/Project):** The existing `exec-approvals.ts` system is technically mature and covers 90% of the governance needs (Allowlists, Human-in-the-loop).
3.  **Local Supervisor (Reuse):** The Rust/Tauri supervisor is already capable of managing the local environment, including PostgreSQL and Docker.
4.  **Canonical State (Adapt):** We must move from file-based `meta.json` and `events.jsonl` to the local PostgreSQL already provisioned by the supervisor.
5.  **Mission Coordinator (Build):** This is the missing "brain" that translates a Mission Charter into OpenClaw execution steps and projects the state back to the Case File.
6.  **Mission Control (Adapt/Project):** The Desktop UI is already "wired" for Chat and Runs. It needs to be projected as a governance surface rather than just a log viewer.
7.  **Branching/Recovery (Build):** Continuity and branching models are not present and must be built at the Coordinator level.
8.  **Hierarchy of Responsibility (Project):** This is a product-layer abstraction that sits on top of OpenClaw's existing agent/sub-agent model.
9.  **Gateway Substrate (Reuse):** The WhatsApp/Messaging gateway remains the primary "Channel" for external triggers.
10. **Capability Registry (Project):** Already partially exists via `skills/` and `tools/`; needs a canonical registry in PG.

---

## 2. Inventory of Existing Primitives

| Primitive | Role | Location | Status | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| **Exec Approvals** | Security, Allowlists, Ask-modes | `src/infra/exec-approvals.ts` | **Mature** | High |
| **Agent Runtime** | Pi-Agent core execution | `src/agents/pi-embedded-runner.ts` | **Mature** | High |
| **Bash Tools** | Tool execution with security | `src/agents/bash-tools.exec.ts` | **Mature** | High |
| **Sandbox (Docker)** | Isolated execution | `src/agents/sandbox/` | **Functional** | High |
| **PostgreSQL Env** | Local DB provisioning | `desktop/src-tauri/src/runtime_pgsql.rs`| **Functional** | High |
| **Run Tracking** | Basic Mission metadata | `desktop/src-tauri/src/runs.rs` | **Partial** | Medium |
| **Messaging Gateway**| External triggers/IO | `gateway/` | **Mature** | High |
| **UI Chat/Run** | UX Surface | `desktop/src/pages/` | **Advanced** | High |

---

## 3. Mapping Global V2 Concept by Concept

| Concept V2 | Exists in OpenClaw? | Recommended Integration | Effort |
| :--- | :--- | :--- | :--- |
| **Mission Charter** | No | **Build:** New structured contract in PG/JSON. | Low |
| **Case File** | Partial (Runs) | **Adapt:** Expand `Run` model to a canonical DB record. | Medium |
| **Mission State Projection** | No | **Project:** UI-side interpretation of the Case File. | Low |
| **Human on the loop** | Yes | **Attach:** Map `ExecApprovalDecision` to `ValidationRecord`. | Low |
| **Mission Cycle** | Partial | **Build:** State machine in Mission Coordinator. | Medium |
| **Responsibility Ledger** | No | **Build:** Audit trail in PG linked to agent actions. | Medium |
| **Artifacts** | Yes (Files) | **Adapt:** Link workspace files to canonical DB metadata. | Low |
| **Branching/Recovery** | No | **Build:** Snapshot & Resume logic in Coordinator. | High |
| **Mission Control** | Partial (Tauri) | **Adapt:** Enrich existing UI with governance data. | Medium |

---

## 4. Build vs Attach vs Adapt Matrix

| Category | Components |
| :--- | :--- |
| **A. Reuse Almost As-Is** | Agent Runtime, Docker Sandboxing, Tool schemas, WhatsApp Gateway, PTY support. |
| **B. Adapt Partially** | `Run` model (move to PG), `Policies` UI (link to `exec-approvals`), `Artifacts` (link to DB). |
| **C. Attach (Thin Layer)** | Mapping `Exec Approvals` signals to Governance Records. |
| **D. Project (Product Layer)** | Hierarchy of Responsibility (Logical grouping of existing agents). |
| **E. True New Build** | **Mission Coordinator** (The brain), **Mission Charter** (The intent), **Continuity Model** (Recovery). |

---

## 5. What Must NOT be Rebuilt

1.  **Agent Logic:** Do not rewrite the Pi-Agent or LLM interaction logic. OpenClaw handles the "how" of talking to models perfectly.
2.  **Tool Security:** The `exec-approvals.ts` system is already quotation-aware and has safe-bin logic. **Do not rebuild the security sandbox.**
3.  **Binary Provisioning:** The Rust supervisor already handles PostgreSQL, Docker checks, and Node-PTY. Keep this as the substrate.
4.  **Messaging Drivers:** Baileys (WhatsApp), Discord, Slack drivers are mature. Leverage them as "Channels".

---

## 6. What MUST be Built

1.  **The Mission Coordinator:** A central orchestrator (likely in TS/Node or Rust) that maintains the mission state machine independently of a single agent session.
2.  **Canonical PostgreSQL Schema:** Moving from flat files to a structured schema (Charter, CaseFile, Contracts, Records).
3.  **Governance Translation:** Logic that turns an OpenClaw "Approval Request" into a "Mission Decision Record".

---

## 7. Permissions and Approvals as Execution Substrate

OpenClaw's permission system is the **Enforcement Layer**. Our V2 Product is the **Policy Layer**.

*   **Mapping:**
    *   `ExecSecurity: allowlist` -> Becomes a part of the **Mission Charter**.
    *   `ExecAsk: always` -> Becomes the **Control Layer** setting for high-stakes missions.
    *   `ExecApprovalDecision` -> Recorded as a **Validation Record** in the Case File.
*   **Projection:** The UI should show "Pending Approvals" as "Governance Gates" requiring human validation to resume the mission trajectory.

---

## 8. Recommended Architectural Layering

| Layer | Responsibility | Technology |
| :--- | :--- | :--- |
| **1. Mission Control** | UX, Supervision, State Projection | React / Tauri |
| **2. Mission Coordinator**| Governance Brain, State Machine, Continuity | TypeScript (Core) |
| **3. Canonical State** | Source of Truth (Charter, Case File) | PostgreSQL (Local) |
| **4. OpenClaw Substrate** | Tool Execution, Permissions, Approvals | TS (Node-Host) |
| **5. Runtime Supervisor** | Lifecycle, DB/Docker Mgmt, PTY | Rust (Tauri) |

---

## 9. Repo-Grounded Integration Points

| Point | Integration Strategy |
| :--- | :--- |
| `src/infra/exec-approvals.ts` | **Attach:** Hook into `requestExecApprovalViaSocket` to record decisions in PG. |
| `src/agents/pi-embedded-runner.ts`| **Wrap:** Coordinator should wrap the runner to track turns and state. |
| `desktop/src-tauri/src/runs.rs` | **Adapt:** Replace file-based persistence with `runtime_pgsql.rs` queries. |
| `desktop/src/pages/RunDetail.tsx` | **Enrich:** Add "Mission State Projection" and "Charter" views. |
| `src/agents/skills/` | **Register:** Map existing skills to the `Capability Registry`. |

---

## 10. Impacts on MVP Roadmap

*   **Acceleration:** We don't need to build a new UI or a new agent runner. We can "upgrade" the existing `Runs` to `Missions`.
*   **Focus:** The main dev effort shifts to the **Mission Coordinator** and the **PostgreSQL Schema**.
*   **De-risking:** Using `exec-approvals.ts` immediately provides the "Human on the loop" security required for the MVP.

---

## 11. Impacts on V2 Document

*   **Correction:** V2 should explicitly refer to **OpenClaw** as the "Execution Engine".
*   **Clarification:** Distinguish between "Agent Instructions" (OpenClaw level) and "Mission Charter" (Governance level).
*   **Refinement:** The "PostgreSQL" requirement is already half-met by the Tauri supervisor.

---

## 12. Final Recommendations

1.  **Keep OpenClaw as the Substrate:** Avoid any refactoring that pulls orchestration into the agent's core. Orchestration lives *above*.
2.  **Pivot to PostgreSQL Immediately:** The file-based `events.jsonl` is too limited for the Mission State Projection V2 requires.
3.  **Project Governance via UI:** Use the existing `Policies.tsx` and `RunDetail.tsx` to visualize the mission's trajectory and gates.
4.  **Build the Coordinator as a Wrapper:** It should "supervise" one or more OpenClaw agent sessions to fulfill a Charter.

