# OpenClaw Master Orchestration Matrix V1

## 1. Statut du document

Ce document est un artefact dérivé normatif de la V2.

Il ne reformule pas la vision produit. Il fixe la grammaire opérationnelle minimale qui permet de vérifier, ligne par ligne, si une trajectoire missionnelle, une transition d'objet, une intervention, une recovery ou une projection Mission Control respecte la logique du système cible.

Il sert de charnière entre :

- la V2 conceptuelle
- les objets structurants du noyau missionnel
- les projections Mission Control
- les futurs services applicatifs
- le futur mapping repo grounded vers le Node existant d'OpenClaw

## 2. Objectif

Le document relie explicitement :

- les phases du cycle missionnel
- les niveaux de responsabilité actifs
- les rôles logiques mobilisés
- les objets structurants concernés
- les contrats mobilisés
- les transitions demandées
- les gates et ratifications
- les bundles de preuve minimaux
- les failures et recoveries
- les records à écrire
- la projection Mission Control attendue
- le phasage build première vague / deuxième vague / moyen terme

## 3. Ce que ce document n'est pas

Ce document n'est pas :

- une roadmap de sprint détaillée
- une spec SQL champ par champ
- une API exhaustive
- une maquette UI autonome
- un backlog brut
- un document marketing contributeur

## 4. Principes directeurs figés

1. Le système est structuré autour d'un centre missionnel persistant.
2. Le Mission Coordinator est l'autorité fonctionnelle qui fait devenir vrai l'état canonique.
3. Mission Control est une projection dérivée, pas une source de vérité.
4. Le build doit réutiliser au maximum le moteur existant au lieu de reconstruire un orchestrateur parallèle.
5. Les lignes de matrice décrivent des actes gouvernés significatifs.
6. Les couplages synchronisés font partie de la vérité de design, pas d'un comportement optionnel.
7. Les capacités spécialisées relèvent du capital opératoire et du Capability Registry.
8. Le Capability Registry complet n'appartient pas à la première vague minimale.
9. Les transitions importantes doivent être gouvernées par une combinaison de gate, ratification, preuve, traçabilité et projection.
10. L'UI ne doit jamais inventer une vérité que le backend canonique ne sait pas produire.

## 5. Référentiels fermés

### 5.1 Responsibility levels

| Code | Canonical name | Finalité |
| --- | --- | --- |
| L1 | Policy / Constitution | Borne durablement le système |
| L2 | Strategic Governance | Arbitre, intensifie, ratifie, escalade |
| L3 | Tactical Orchestration | Transforme la mission en trajectoire opérable |
| L4 | Specialized Execution | Produit le travail effectif |
| L5 | Audit and Learning | Audite, score, apprend, enrichit le futur |

Règles :

- une ligne porte un primary responsibility level unique
- les fonctions transverses ne constituent pas un sixième niveau
- le capital opératoire n'est pas un niveau hiérarchique autonome

### 5.2 Logical roles

#### L1 Policy / Constitution

- Constitution Manager
- Risk Policy Manager
- Capability Policy Manager

#### L2 Strategic Governance

- Mission Governor
- Arbitration Agent
- Committee Coordinator
- Intervention Interpreter

#### L3 Tactical Orchestration

- Mission Planner
- Task Router
- Replanning Agent
- Resource Allocator

#### L4 Specialized Execution

- Intent Interpreter
- Domain Advisor
- Solution Architect
- Implementation Agent
- Debug Analyst
- Test Operator
- Documentation Agent
- Research Agent

#### L5 Audit and Learning

- Run Auditor
- Performance Scorer
- Strategy Learner
- Drift Monitor

Règles :

- un rôle logique appartient à un seul responsibility level canonique
- Mission Coordinator n'est pas un logical role canonique
- Mission Control n'est pas un logical role canonique
- l'utilisateur humain n'est pas un logical role canonique du système

### 5.3 Gate types

1. Intake Admissibility Gate
2. Governance Configuration Gate
3. Framing Sufficiency Gate
4. Contract Admissibility Gate
5. Execution Start Gate
6. Validation Intake Gate
7. Validation Sufficiency Gate
8. Promotion Gate
9. Trajectory Change Gate
10. Escalation Gate
11. Recovery Selection Gate
12. Closure Gate
13. Capability Sourcing Gate
14. Capability Qualification Gate
15. Capability Promotion Gate
16. Capability Retirement Gate
17. Exposure Gate
18. Resume Readiness Gate

### 5.4 Ratification modes

1. None
2. Auto
3. Auto Guarded
4. Supervised
5. Human Approved
6. Governed
7. Committee Reviewed
8. Committee Ratified
9. Dual Control

### 5.5 Blast radius classes

| Code | Label | Sens |
| --- | --- | --- |
| BR0 | Local Trivial | Impact très local et réversible |
| BR1 | Local Bounded | Impact local réel mais contenu |
| BR2 | Cross Object | Impact multi objets ou multi zones |
| BR3 | Mission Wide | Impact sur la trajectoire missionnelle |
| BR4 | Systemic Sensitive | Impact critique, sensible ou fortement irréversible |

### 5.6 Control intensity classes

1. CI0 Minimal
2. CI1 Standard
3. CI2 Reinforced
4. CI3 High Scrutiny
5. CI4 Forensic

### 5.7 Evidence bundles

#### Structure minimale

- bundle_id
- mission_id
- linked_object_type
- linked_object_id
- primary_claim
- claim_type
- claim_target_state
- assurance_level_required
- supporting_items
- counter_items
- evidence_sources
- freshness_state
- sufficiency_judgment
- sufficiency_rationale
- unresolved_gaps
- confidence_estimate
- blast_radius_context
- related_gate_type
- related_decision_record_id nullable
- related_validation_record_id nullable
- related_failure_event_id nullable
- related_recovery_record_id nullable
- mission_control_summary
- bundle_status

#### Claim types

1. Readiness Claim
2. Acceptance Claim
3. Promotion Claim
4. Routing Claim
5. Replanning Claim
6. Recovery Claim
7. Resume Claim
8. Safety Claim
9. Capability Qualification Claim
10. Capability Promotion Claim

#### Evidence item types

1. Factual Evidence
2. Evaluative Evidence
3. Governance Evidence
4. Human Preference Evidence
5. Learned Signal Evidence
6. External Dependency Evidence
7. Execution Trace Evidence
8. Validation Result Evidence
9. Diff or Artifact Evidence
10. Comparative Option Evidence

#### Bundle statuses

1. Active
2. Contested
3. Superseded
4. Archived

#### Freshness states

1. Fresh
2. Acceptable
3. Aging
4. Stale
5. Superseded
6. Unknown Freshness

#### Sufficiency judgments

1. Insufficient
2. Weakly Sufficient
3. Sufficient
4. Strongly Sufficient
5. Contested Sufficiency

### 5.8 Failure taxonomy

#### Failure families

1. Technical Failure
2. Validation Failure
3. Alignment Failure
4. Planning Failure
5. Governance Failure
6. Capability Failure
7. Dependency or External Failure
8. Convergence Failure
9. Policy or Risk Failure
10. Coordination Failure

#### Scope levels

1. Local Scope
2. Branch Scope
3. Artifact Scope
4. Contract Scope
5. Mission Scope
6. Systemic Scope

#### Severity levels

1. Minor
2. Moderate
3. Major
4. Critical

#### Reversibility levels

1. Easily Reversible
2. Hard to Reverse
3. Potentially Irreversible

#### Detection modes

1. Execution Detected
2. Validation Detected
3. Governance Detected
4. Human Reported
5. Audit Detected
6. External Signal Detected
7. Resume Time Detected

#### Resolution states

1. Open
2. Contained
3. Under Diagnosis
4. Recovery Selected
5. Resolved
6. Superseded
7. Escalated
8. Closed with Residual Risk

#### Preferred response families

1. Containment First
2. Restorative Recovery
3. Adaptive Recovery
4. Protective Recovery
5. Terminal Recovery
6. Revalidation Required
7. Governance Escalation
8. Replanning Required
9. Capability Review Required
10. Human Clarification Required

### 5.9 Recovery families

| Family | Canonical patterns |
| --- | --- |
| Restorative Recovery | Retry, Repair, Rollback |
| Adaptive Recovery | Reroute, Replan, Safe Partial Completion |
| Protective Recovery | Freeze, Scope Reduction, Policy Tightening, Reinforced Review |
| Terminal Recovery | Controlled Abort, Graceful Closeout |

Règles :

- le containment n'est pas encore une recovery
- l'ouverture d'une recovery est distincte de sa résolution
- une recovery réussie signifie retour à une trajectoire suffisamment gouvernable, pas forcément retour exact à l'état antérieur

### 5.10 Interventions

#### Intervention types

1. Consultative Intervention
2. Preference Intervention
3. Local Instruction Intervention
4. Override Request Intervention
5. Governance Change Intervention
6. Priority Change Intervention
7. Branching Intervention
8. Promotion Intervention
9. Learning Signal Intervention
10. Pause or Freeze Intervention

#### Intervention scopes

1. Mission Scope
2. Branch Scope
3. Contract Scope
4. Artifact Scope
5. Decision Scope
6. Governance Regime Scope

#### Urgency levels

1. Low
2. Normal
3. High
4. Immediate

#### Authority levels

1. Advisory
2. Strong Advisory
3. Binding Local
4. Binding Governance

#### Expected effects

1. Informational Effect
2. Interpretive Effect
3. Constraint Effect
4. Priority Effect
5. Control Effect
6. Branching Effect
7. Promotion Effect
8. Learning Effect

#### Temporalities

1. Immediate
2. Safe Point
3. Checkpoint Bound
4. Persistent
5. Time Limited

#### Resolution statuses

1. Queued
2. Under Evaluation
3. Applied
4. Deferred
5. Redirected
6. Refused
7. Expired
8. Superseded

## 6. Master Orchestration Matrix

### 6.1 Règle de granularité

Une ligne de matrice décrit un acte gouverné significatif.

Exemples distincts :

- admettre une mission
- activer la gouvernance
- admettre un contrat
- ouvrir une validation
- autoriser une promotion
- ouvrir une escalation
- ouvrir une recovery
- résoudre une recovery
- clôturer une mission

### 6.2 Tableau compact strict V1

| Matrix ID | Governed act | Mission phase | Responsibility level | Logical role | Primary object | Gate type | Default ratification | Default blast radius | Default control intensity | Primary claim type | Canonical outcome set | MVP status | Repo grounding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOM-001 | Mission admitted | Intake and Mission Framing | L2 Strategic Governance | Mission Governor | Mission | Intake Admissibility Gate | Auto | BR1 Local Bounded | CI1 Standard | Safety Claim | admitted, conditionally_admitted, deferred, refused | in scope | aligned |
| MOM-002 | Governance activated | Governance Activation | L2 Strategic Governance | Mission Governor | Mission governance envelope | Governance Configuration Gate | Auto Guarded | BR3 Mission Wide | CI2 Reinforced | Safety Claim | activated, conditionally_activated, escalated, refused | in scope | partial |
| MOM-003 | Mission Charter activated | Plan Construction | L3 Tactical Orchestration | Mission Planner | Mission Charter | Framing Sufficiency Gate | Auto Guarded | BR3 Mission Wide | CI2 Reinforced | Readiness Claim | activated, activated_with_conditions, sent_back_for_reframing, escalated | in scope | direct |
| MOM-004 | Case File opened | Plan Construction | L3 Tactical Orchestration | Mission Planner | Case File | Framing Sufficiency Gate | None | BR1 Local Bounded | CI1 Standard | Resume Claim | opened, refreshed, refused_if_missing_charter | in scope | direct |
| MOM-005 | Initial contract admitted | Plan Review and Admission | L3 Tactical Orchestration | Task Router | Contract | Contract Admissibility Gate | Auto Guarded | BR2 Cross Object | CI2 Reinforced | Readiness Claim | admitted, admitted_with_conditions, deferred, refused, escalated | in scope | direct |
| MOM-006 | Controlled execution started | Controlled Execution | L4 Specialized Execution | Implementation Agent | Running contract | Execution Start Gate | Auto Guarded | BR2 Cross Object | CI2 Reinforced | Readiness Claim | started, started_guarded, deferred, blocked, refused | in scope | direct |
| MOM-007 | Validation requested on artifact | Continuous Control Loop | L3 Tactical Orchestration | Task Router | Artifact under review | Validation Intake Gate | None | BR1 Local Bounded | CI2 Reinforced | Acceptance Claim | review_opened, review_deferred, review_refused_if_insufficient | in scope | partial |
| MOM-008 | Artifact promotion authorized | Artifact Promotion and Acceptance | L2 Strategic Governance | Mission Governor | Artifact | Promotion Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Promotion Claim | authorized, conditionally_authorized, deferred, refused, escalated | in scope | partial |
| MOM-009 | Replanning triggered | Decision and Replanning Junction | L3 Tactical Orchestration | Replanning Agent | Mission trajectory | Trajectory Change Gate | Supervised | BR3 Mission Wide | CI2 Reinforced | Replanning Claim | local_replan, global_replan, deferred, escalated, refused | in scope conceptuelle | partial |
| MOM-010 | Escalation opened | Continuous Control Loop / Decision and Replanning Junction | L2 Strategic Governance | Arbitration Agent | Mission or Contract | Escalation Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Safety Claim | escalated, conditionally_escalated, deferred, refused_if_not_justified | in scope minimal | partial |
| MOM-011 | Recovery opened | Continuous Control Loop / Decision and Replanning Junction | L2 Strategic Governance | Mission Governor | Mission trajectory in recovery | Recovery Selection Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Recovery Claim | recovery_opened, recovery_opened_guarded, escalated, refused_if_disproportionate | target proche | partial |
| MOM-012 | Mission closed | Delivery / Deployment Decision or Post Mission Audit and Learning | L2 Strategic Governance | Mission Governor | Mission | Closure Gate | Governed | BR3 Mission Wide | CI2 Reinforced | Acceptance Claim / Safety Claim | completed, safe_partial_completion, aborted, suspended, handed_over, forensic_review_opened | in scope | partial |
| MOM-013 | Resume readiness evaluated | Post Mission Audit and Learning or active resume point | L3 Tactical Orchestration | Mission Planner | Mission State Projection / Case File | Resume Readiness Gate | Supervised | BR2 Cross Object | CI2 Reinforced | Resume Claim | ready, conditionally_ready, not_ready, needs_reframing | in scope | partial |
| MOM-014 | Delivery or deployment authorized | Delivery / Deployment Decision | L2 Strategic Governance | Mission Governor | Deliverable or deployable artifact | Promotion Gate | Governed | BR4 Systemic Sensitive | CI3 High Scrutiny | Safety Claim / Promotion Claim | authorized, conditionally_authorized, deferred, refused, escalated | target proche | partial |
| MOM-015 | Capability sourcing requested | Controlled Execution or Decision and Replanning Junction | L3 Tactical Orchestration | Resource Allocator | Capability request | Capability Sourcing Gate | Supervised | BR2 Cross Object | CI2 Reinforced | Routing Claim / Capability Qualification Claim | approved_for_trial, reuse_existing, defer, refused, escalated | target proche | conceptual |
| MOM-016 | Capability qualified | Post Mission Audit and Learning | L5 Audit and Learning | Performance Scorer | Experimental capability | Capability Qualification Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Capability Qualification Claim | qualified, qualified_with_restrictions, remain_experimental, refused | moyen terme | conceptual |
| MOM-017 | Capability promoted | Post Mission Audit and Learning | L2 Strategic Governance | Mission Governor | Qualified capability | Capability Promotion Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Capability Promotion Claim | promoted, promoted_guarded, deferred, refused | moyen terme | conceptual |
| MOM-018 | Capability retired | Post Mission Audit and Learning | L2 Strategic Governance | Mission Governor | Institutional or qualified capability | Capability Retirement Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Safety Claim | retired, deprecated, restricted, deferred | moyen terme | conceptual |
| MOM-019 | Intervention applied | Continuous Control Loop or Decision and Replanning Junction | L2 Strategic Governance / L3 Tactical Orchestration | Intervention Interpreter | Intervention | Trajectory Change Gate or Governance Configuration Gate | Supervised / Governed | BR2 Cross Object | CI2 Reinforced | Routing Claim / Safety Claim | applied, applied_guarded, deferred, redirected, refused | target proche | conceptual partial |
| MOM-020 | Recovery resolved | Continuous Control Loop or Delivery / Deployment Decision | L2 Strategic Governance | Mission Governor | Recovery | Recovery Selection Gate or Closure Gate | Governed | BR3 Mission Wide | CI3 High Scrutiny | Recovery Claim | restored, adapted_path_active, protected_state_active, terminal_closeout, escalated_again | target proche | conceptual partial |

### 6.3 Tableau étendu de contrôle V1

| Matrix ID | Expected evidence sufficiency | Typical failure linkage | Intervention compatibility | Recovery linkage | Primary record write | Secondary record updates | Primary Mission Control surface | Projection depth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOM-001 | Sufficient | none nominally | initial human request, preference, scope constraint | none | Mission or admission Decision Record | Mission State Projection initialisation | Mission Header | low to medium |
| MOM-002 | Sufficient to Strongly Sufficient | Policy or Risk Failure if regime misconfigured | Governance Change Intervention, Override Request | Protective Recovery via Policy Tightening | Governance Decision Record | Mission State Projection, policy context | Mission Header | medium |
| MOM-003 | Sufficient | Planning Failure, Alignment Failure | Preference, Priority Change, Local Instruction upstream | Adaptive Recovery via Replan | Mission Charter or framing Decision Record | Mission State Projection, Case File seed | Mission Header + Reference Trajectory Panel | medium |
| MOM-004 | Weakly Sufficient | Coordination Failure if continuity omitted | later continuity interventions, resume constraints | none direct | Case File | Mission State Projection continuity markers | Resume and Actions Panel | low |
| MOM-005 | Sufficient | Capability Failure, Planning Failure, Alignment Failure | Priority Change, Branching, Governance Change | Adaptive or Protective if contract must be re scoped | Contract or contract admission Decision Record | Mission State Projection, contract set | Active Contracts Panel | medium |
| MOM-006 | Weakly Sufficient to Sufficient | Technical Failure, Capability Failure, Dependency or External Failure, Convergence Failure | Pause or Freeze, Priority Change, Local Instruction | Restorative, Adaptive or Protective depending on failure | Contract state update to running plus activation trace | Mission State Projection, Case File execution trace | Active Contracts Panel + Reference Trajectory Panel | medium |
| MOM-007 | Weakly Sufficient for intake | Validation Failure if too weak even for review | Consultative, Promotion, Governance Change | Revalidation Required, Repair or Rework downstream | Validation Record opened | Mission State Projection, artifact review status | Decision and Validation Feed + Recent Artifacts Panel | medium |
| MOM-008 | Strongly Sufficient | Validation Failure, Governance Failure, Policy or Risk Failure | Promotion Intervention, Governance Change | Protective Recovery, Revalidation Required, Escalation | Promotion Decision Record | Artifact state, Mission State Projection, Case File | Recent Artifacts Panel + Decision and Validation Feed | high |
| MOM-009 | Sufficient | Planning Failure, Convergence Failure, Coordination Failure, Alignment Failure | very strong compatibility, especially explicit human redirect or reprioritisation | Adaptive Recovery, mainly Replan or Reroute | Replanning Decision Record | Mission State Projection, active contracts, Case File rationale | Reference Trajectory Panel + Decision and Validation Feed | high |
| MOM-010 | Sufficient with explicit risk rationale | Policy or Risk Failure, Governance Failure, Validation Failure, Convergence Failure | Governance Change, Override Request, explicit human escalation | usually Protective Recovery or committee path after escalation | Escalation Decision Record | Mission State Projection governance state, Case File, affected objects | Mission Header + Decision and Validation Feed | high |
| MOM-011 | Sufficient to Strongly Sufficient | mandatory failure linkage | very strong compatibility | one canonical recovery family must be selected | Recovery Record or recovery opening Decision Record | Mission State Projection, Case File, related failure event | Mission Header + Reference Trajectory Panel + Resume and Actions Panel | high |
| MOM-012 | Sufficient for clean closure, Strongly Sufficient for degraded closure | optional for normal closure, mandatory for degraded or aborted closure | Pause, Freeze, Promotion, Governance Change, Local Instruction | Terminal Recovery or Safe Partial Completion may precede closure | Closure Decision Record | Mission State Projection terminal state, Resume Snapshot or audit trigger, Case File | Mission Header + Resume and Actions Panel + Decision and Validation Feed | high |
| MOM-013 | Sufficient, sometimes Strongly Sufficient in sensitive missions | Resume Time Detected issues, Coordination Failure, Planning Failure | resume request, priority change, freeze or resume constraint | Replan, Scope Reduction, Freeze if not safely resumable | Resume Decision Record or Resume Snapshot update | Mission State Projection, Case File, pending blockers | Resume and Actions Panel | medium to high |
| MOM-014 | Strongly Sufficient | Validation Failure, Policy or Risk Failure, Governance Failure | Promotion, Governance Change, explicit human hold or approval | Freeze, Policy Tightening, Graceful Closeout before real deployment | Delivery or deployment Decision Record | Artifact deliverable state, Mission State Projection, Case File | Decision and Validation Feed + Recent Artifacts Panel | high |
| MOM-015 | Sufficient | Capability Failure, Planning Failure, cost or security incompatibility | Governance Change, Local Instruction, sourcing preference | Replan, Scope Reduction, Fallback to existing capability | Capability sourcing Decision Record or candidate entry | Mission diagnostics, candidate capability list, Mission State Projection if blocking | Resume and Actions Panel or diagnostics view | medium |
| MOM-016 | Strongly Sufficient | Capability Failure, Drift, poor real world utility, unstable outputs | maintainer or governance feedback more than mission local intervention | restrict scope, remain experimental, retire candidate | Capability qualification Decision Record | Capability registry status, audit trail | audit or admin surface rather than mission panel | high maintainer, low mission |
| MOM-017 | Strongly Sufficient | Capability Failure, Policy or Risk Failure, redundancy or governance mismatch | governance or maintainer intervention | rollback to qualified, guarded exposure, later retirement | Capability promotion Decision Record | Capability Registry, policy mappings, operational availability map | admin or registry surface | high maintainer |
| MOM-018 | Strongly Sufficient | fragility, obsolescence, risk growth, replacement or excessive cost | governance or maintainer intervention | fallback capability, scope restriction, transitional coexistence | Capability retirement Decision Record | Capability Registry, compatibility map, mission advisories if needed | admin surface, warnings if mission active impact | high maintainer |
| MOM-019 | Sufficient, stronger if authority is binding | can itself create Coordination Failure or Policy or Risk Failure if misapplied | constitutive, intervention is the source object | Replan, Freeze, Scope Reduction, Policy Tightening if impact is destabilizing | Intervention application Decision Record | Intervention status, Mission State Projection, Case File, maybe affected trajectory | Mission Header + Decision and Validation Feed | medium to high |
| MOM-020 | Strongly Sufficient | mandatory linkage to the failure and active recovery | high, especially if human wants resume, closeout or stronger containment | none for the current recovery, because this row resolves it | Recovery resolution Decision Record plus Recovery Record update | Mission State Projection, Case File, failure event, maybe closure path | Mission Header + Resume and Actions Panel + Decision and Validation Feed | high |

## 7. Table des couplages synchronisés

### 7.1 Types canoniques de couplage

1. Object State Coupling
2. Record Write Coupling
3. Projection Coupling
4. Governance Regime Coupling
5. Continuity Coupling
6. Validation Coupling
7. Recovery Coupling
8. Capability Registry Coupling
9. Exposure Coupling
10. Audit and Learning Coupling

### 7.2 Tableau V1

| Source Matrix ID | Source act | Coupling type | Secondary target | Required synchronized effect | Canonical record implication | Mission State Projection implication | Mission Control implication | Governance implication | Continuity implication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOM-001 | Mission admitted | Projection Coupling | Mission State Projection | initialize mission visibility, initial phase, initial mode | Mission record, optional admission Decision Record | mission exists as governable unit | Mission Header can appear | initial governance need may be flagged | continuity not yet sufficient by itself |
| MOM-001 | Mission admitted | Continuity Coupling | Case File opening path | create expectation that continuity will open if mission stays active | no Case File write yet, continuity obligation active | continuity gap may become visible later | no false resume readiness | none direct | prepares MOM-004 |
| MOM-002 | Governance activated | Governance Regime Coupling | Mission governance envelope | active regime and control posture become explicit | Governance Decision Record | governance_state explicit | Mission Header shows regime or guard posture | control intensity basis becomes active | future resume and recovery must respect regime |
| MOM-003 | Mission Charter activated | Object State Coupling | Case File seed | framing facts and closure criteria become continuity material | Charter record and optional framing Decision Record | reference trajectory derivable | Header and trajectory panel become stable | downstream contracts must align | continuity seed possible |
| MOM-003 | Mission Charter activated | Projection Coupling | Reference trajectory | initial trajectory becomes explicit | trajectory projection update | initial direction visible | Reference Trajectory Panel appears | future replans compare against baseline | resume depends on baseline |
| MOM-004 | Case File opened | Continuity Coupling | Resume layer | mission becomes continuity capable at minimal level | Case File write | continuity markers appear | Resume and Actions Panel becomes meaningful later | none direct | resumability can later be evaluated |
| MOM-005 | Initial contract admitted | Object State Coupling | Active contract set | contract enters active mission structure | Contract write or admission Decision Record | active contract count and focus can change | Active Contracts Panel updates | governance may tighten if sensitive | continuity must remember admitted contracts |
| MOM-005 | Initial contract admitted | Projection Coupling | Focus and dependency map | focus and dependency context become richer | contract and projection update | focus may shift | contracts view and trajectory cues update | none direct | future replans depend on structure |
| MOM-006 | Controlled execution started | Record Write Coupling | Execution trace | running activation must leave execution trace | contract running state plus execution trace | active work becomes visible | contracts panel and trajectory cues show running | guarded execution may alter supervision | diagnosis and audit require trace continuity |
| MOM-006 | Controlled execution started | Audit and Learning Coupling | future audit path | execution must be auditable later | execution trace or run linkage | none immediate | none or minimal live UI | none direct | later audit depends on trace quality |
| MOM-007 | Validation requested on artifact | Validation Coupling | Validation layer | artifact enters formal review space | Validation Record opened | review status derivable | Decision and Validation Feed updates | promotion blocked until validation advances | unresolved review preserved |
| MOM-007 | Validation requested on artifact | Projection Coupling | Recent artifact state | artifact visible as under review, not yet accepted | artifact status update and validation link | review marker appears | Recent Artifacts Panel may show badge | none direct | resume must know artifact unresolved |
| MOM-008 | Artifact promotion authorized | Object State Coupling | Artifact accepted state | artifact acquires higher institutional status | Promotion Decision Record and artifact update | accepted artifact enters mission truth | Recent Artifacts Panel reflects accepted state | stronger governance history exists | accepted value preserved |
| MOM-008 | Artifact promotion authorized | Projection Coupling | Trajectory progress | trajectory may advance or unlock next stage | decision and projection updates | milestone advancement visible | trajectory panel and feed show advancement | later delivery or closure may become admissible | continuity captures accepted value |
| MOM-009 | Replanning triggered | Governance Regime Coupling | Reference trajectory | previous path may no longer be current reference | Replanning Decision Record | focus, blocker, risk and trajectory may shift | trajectory panel updates | governance may intensify if major replan | continuity preserves rationale |
| MOM-009 | Replanning triggered | Object State Coupling | Active contracts and priorities | running or admitted work may need reorientation | contract updates or linked decision notes | focus and next actions may change | contracts panel and resume actions update | possible supervision increase | branch change rationale preserved |
| MOM-010 | Escalation opened | Governance Regime Coupling | Mission governance state | regime changes to escalated or guarded form | Escalation Decision Record | governance_state changes explicitly | Header and feed show escalated posture | ratification expectations rise | resume and recovery must respect escalated regime |
| MOM-010 | Escalation opened | Exposure Coupling | UI and action permissions | some actions may require stronger justification or be restricted | decision notes and policy context | reduced action freedom may be projected | UI can surface hold or guard states | some auto paths no longer allowed | escalation rationale preserved |
| MOM-011 | Recovery opened | Recovery Coupling | Failure and recovery system | active failure linked to chosen recovery family | Recovery Record plus failure linkage | active recovery state visible | Header, trajectory panel and resume panel show recovery | governance stays guarded or escalated | diagnosis and chosen response preserved |
| MOM-011 | Recovery opened | Projection Coupling | Top blocker and next safe path | stabilization posture becomes legible | recovery and projection updates | blocker, risk and recovery mode visible | safer operation guidance appears | control intensity often rises | resume constrained until resolution |
| MOM-012 | Mission closed | Projection Coupling | Terminal mission state | mission enters completed, suspended, aborted or handover state | Closure Decision Record | terminal state explicit | Header and actions panel reflect end state | governance ends or shifts to audit | continuity moves to snapshot or archive |
| MOM-012 | Mission closed | Audit and Learning Coupling | Post mission audit path | closure may trigger audit, learning or handover obligations | closure plus optional audit trigger | no active trajectory unless suspended | UI may shift to summary or handover | governance may persist if forensic review opens | continuity becomes archival or handover oriented |
| MOM-013 | Resume readiness evaluated | Continuity Coupling | Resume snapshot and blockers | safe resumption posture becomes explicit | Resume Decision Record or snapshot update | resume_readiness and blockers projected | Resume and Actions Panel actionable | governance may escalate if unsafe | continuity becomes explicit judgment |
| MOM-013 | Resume readiness evaluated | Projection Coupling | Next safe action | if resumable, next safe action becomes visible | resume update and projection change | next safe action appears | Resume and Actions Panel guides restart | none or escalation if unsafe | continuity quality visible |
| MOM-014 | Delivery or deployment authorized | Exposure Coupling | Deliverable exposure state | artifact becomes authorized for delivery or deployment | Delivery or deployment Decision Record | deliverable state explicit | feed and artifact panel show deployable posture | strong governance confirmation exists | rollback and residual risk preserved |
| MOM-014 | Delivery or deployment authorized | Governance Regime Coupling | terminal risk posture | residual risk and rollback posture may need guarding | decision plus safety context | deployment risk context projected | UI may expose residual risk note | high scrutiny may persist through deployment | handover continuity may require stronger notes |
| MOM-015 | Capability sourcing requested | Capability Registry Coupling | capability candidate path | system checks reuse, trial or fallback before ad hoc creation | sourcing Decision Record or candidate entry | mission may show blocked by capability gap | diagnostics or actions can show sourcing need | policy filters sourcing options | rejected alternatives preserved |
| MOM-015 | Capability sourcing requested | Governance Regime Coupling | policy and security constraints | repo, network, workspace or model boundaries considered | sourcing record includes constraints | no direct projection unless blocking | diagnostics may show constrained options | capability policy becomes active filter | continuity stores rejected options |
| MOM-016 | Capability qualified | Capability Registry Coupling | capability status | experimental capability may enter qualified state | qualification Decision Record | no mission projection by default | admin or audit surface only | registry governance strengthens | later missions may reference qualified capability |
| MOM-017 | Capability promoted | Capability Registry Coupling | institutional registry | capability enters durable governed availability | promotion Decision Record and registry update | active missions may later see new availability | admin or registry UI updates | governance accepts maintenance burden | future continuity may rely on it |
| MOM-018 | Capability retired | Capability Registry Coupling | capability availability map | capability becomes restricted, deprecated or removed | retirement Decision Record and registry update | dependent missions may need advisory markers | admin warnings and maybe mission warnings | governance must preserve continuity for dependents | fallback mappings may be required |
| MOM-019 | Intervention applied | Governance Regime Coupling | target trajectory or regime | intervention changes constraints, priorities or control posture | intervention application Decision Record | projection reflects active intervention effect | header and feed may show active intervention | governance may tighten or redirect | why path changed is preserved |
| MOM-019 | Intervention applied | Object State Coupling | affected contract, artifact or branch | targeted objects may need updated state or priority | linked object updates plus intervention status | focus, blockers or next actions may shift | contracts, trajectory or actions panel update | authority level determines depth of effect | target scope and temporality preserved |
| MOM-020 | Recovery resolved | Recovery Coupling | recovery state and linked failure | active recovery moves to resolved outcome and failure updates accordingly | Recovery resolution Decision Record plus Recovery Record update | recovery inactive and resulting path explicit | header, feed and actions panel reflect resulting state | governance may relax or remain guarded | post recovery posture preserved |
| MOM-020 | Recovery resolved | Projection Coupling | resulting trajectory | restored, adapted, protected or terminal path becomes new posture | projection and related decision updates | next mode and next safe action visible | actions panel and trajectory cues update | governance may remain guarded after recovery | resume and closure possibilities change |

## 8. Crosswalk build oriented

### 8.1 Records canoniques minimaux, première vague

| Record | Rôle minimal | Champs minimaux indicatifs |
| --- | --- | --- |
| Mission | Objet racine persistant | mission_id, title, mode, phase, status, health_state, governance_state, created_at, updated_at |
| Mission Charter | Cadrage autoritaire | charter_id, mission_id, objective_summary, constraints_summary, closure_criteria_summary, framing_status, created_at, updated_at |
| Case File | Mémoire vivante gouvernable | case_file_id, mission_id, current_summary, pending_obligations_summary, blocker_summary, risk_summary, continuity_notes, updated_at |
| Contract | Unité gouvernée d'activation | contract_id, mission_id, contract_type, title_or_intent, lifecycle_state, governance_state, health_state, created_at, updated_at |
| Artifact | Objet produit ou soumis à validation | artifact_id, mission_id, contract_id nullable, artifact_type, title, lifecycle_state, governance_state, health_state, created_at, updated_at |
| Decision Record | Trace institutionnelle de décision | decision_record_id, mission_id, related_object_type, related_object_id nullable, transition_type, claim_summary, rationale_summary, responsibility_level, logical_role, ratification_mode, created_at |
| Validation Record | Chemin de validation | validation_record_id, mission_id, artifact_id, validation_status, claim_summary, sufficiency_judgment, created_at, updated_at |
| Resume Snapshot | Objet de reprise | resume_snapshot_id, mission_id, summary, blocker_summary, next_safe_action, resume_readiness, created_at |
| Responsibility Ledger Entry | Trace minimale de responsabilité | ledger_entry_id, mission_id, related_record_type, related_record_id, responsibility_level, logical_role, control_intensity, timestamp |

### 8.2 Records de deuxième vague

- Recovery Record détaillé
- Intervention Record enrichi
- Evidence Bundle persistant complet
- Failure Event persistant riche
- Committee Record
- Capability Registry record complet

### 8.3 Projections minimales Mission Control

#### MissionControlMissionView

Champs minimaux recommandés :

- mission_id
- title
- mode
- phase
- status
- health_state
- governance_state
- reference_path_label
- current_focus
- current_next_best_action
- top_blocker
- top_risk
- resume_readiness
- needs_human_attention
- last_decision_summary
- last_validation_summary
- active_contracts_preview
- recent_artifacts_preview
- updated_at

#### Sous projections secondaires

- Mission list item
- Active contracts preview
- Recent artifacts preview
- Resume panel projection

### 8.4 Services applicatifs minimaux, première vague

| Service | Responsabilités minimales |
| --- | --- |
| Mission Service | create mission, get mission, list missions, update dominant phase and mission state, close mission |
| Charter and Case File Service | create or update charter, open case file, update continuity summary, prepare resume oriented summaries |
| Contract Service | create contract, admit contract, list active contracts, mark contract running/blocked/failed/completed, attach contract to activation episodes |
| Artifact and Validation Service | create artifact, update artifact lifecycle state, open validation, record validation result, authorize artifact promotion |
| Decision and Ledger Service | record significant decision, record responsibility ledger entry, expose latest decision summaries |
| Resume Service | create resume snapshot, evaluate resume readiness, expose next safe action and blockers, orchestrate resume path selection |
| Mission Control Projection Service | maintain or compute MissionControlMissionView from canonical state, expose mission list projections, expose previews |

### 8.5 Services de deuxième vague

- Recovery Service
- Intervention Service
- Evidence and Failure Service
- Capability Registry Service

### 8.6 Mapping direct matrice vers build minimal

| Matrix zone | Records minimaux requis | Projection minimale requise | Service minimal requis |
| --- | --- | --- | --- |
| Mission admission and governance | Mission, optional Decision Record | Mission header basics | Mission Service |
| Charter and continuity opening | Mission Charter, Case File | reference path seed, continuity seed | Charter and Case File Service |
| Contract admission and execution start | Contract, execution trace link | active contracts preview, focus update | Contract Service |
| Validation and promotion | Artifact, Validation Record, Decision Record | recent artifacts preview, last validation summary, last decision summary | Artifact and Validation Service + Decision and Ledger Service |
| Replanning and escalation | Decision Record, ledger entry | trajectory shift, governance state, top blocker or top risk | Mission Service + Decision and Ledger Service |
| Resume readiness and closure | Resume Snapshot, Decision Record | resume panel, terminal state projection | Resume Service + Mission Service |

## 9. Phasage figé

### 9.1 Première vague

Noyau minimal à rendre vrai dans le build :

- Mission
- Mission Charter
- Case File
- Contract
- Artifact
- Decision Record
- Validation Record
- Resume Snapshot
- Responsibility Ledger Entry
- MissionControlMissionView
- Mission Service
- Charter and Case File Service
- Contract Service
- Artifact and Validation Service
- Decision and Ledger Service
- Resume Service
- Mission Control Projection Service

### 9.2 Deuxième vague

Capacités structurelles importantes mais non nécessaires pour le premier noyau cohérent :

- Recovery Service riche
- Intervention Service enrichi
- Evidence and Failure Service persistant riche
- Capability Registry Service
- Recovery Record détaillé
- Intervention Record détaillé
- Failure Event riche
- Evidence Bundle persistant complet

### 9.3 Moyen terme

- qualification, promotion et retirement complets des capacités
- policy de modèles par sous tâche plus riche
- familles de capacités spécialisées stabilisées
- intelligence de code gouvernée
- editing and debug support capabilities institutionnalisées
- comités riches, exposition plus détaillée, audit et learning étendus

## 10. Capacités spécialisées à ne pas oublier

### 10.1 Code Intelligence Capabilities

Sous familles recommandées :

1. Structure Mapping
2. Impact Analysis
3. Symbol Context Expansion
4. Diff Risk Analysis
5. Safe Rename / Refactor Assistance
6. Architecture Summarization
7. Test Surface Identification
8. Repository Inventory and Indexing

Principe :

- ce sont des fournisseurs de contexte structuré et de preuve opératoire
- ils ne remplacent pas le centre missionnel canonique
- ils relèvent du capital opératoire et du Capability Registry

### 10.2 Editing and Debug Support Capabilities

Sous familles recommandées :

1. Incremental File Edit
2. Structured Patch Apply
3. Cross File Snippet Transfer
4. Output and Error Parsing
5. Build and Test Failure Diagnosis
6. Artifact Diff Inspection
7. Safe Regeneration Boundary Detection

Principe :

- à mobiliser avant réécriture complète quand le changement est localisé
- améliore la sobriété token, la stabilité des modifications et la vitesse de recovery locale
- à traiter comme famille candidate du Capability Registry

## 11. Règles de figement et d'usage

Une fois exporté, ce document doit être utilisé comme :

- base normative pour les artefacts de build
- référence d'évaluation de cohérence
- garde fou contre la dérive conceptuelle
- source de travail pour le mapping repo grounded

Il ne doit pas être traité comme :

- un backlog de sprint brut
- une spec SQL détaillée
- une maquette UI autonome
- un texte marketing contributeur

## 12. Points explicitement laissés à la phase repo grounded

1. Schéma SQL détaillé champ par champ
2. API concrète exhaustive
3. Détails précis d'événements, workers et files de messages
4. Mapping exact fichier par fichier vers le repo Node existant
5. Stratégie détaillée de migrations et d'incréments repo grounded
6. Shape exact des records riches de deuxième vague
7. Design détaillé du Capability Registry complet
8. Mapping détaillé rôles vers familles de modèles

## 13. Consigne pour le futur mapping Gemini

Quand ce document sera utilisé pour le mapping repo grounded, la consigne devra être :

1. prendre ce document comme source normative
2. faire un mapping maximal vers les composants réels Node/OpenClaw existants
3. identifier ce qui peut être conservé tel quel
4. identifier où insérer le Mission Coordinator comme autorité canonique sans dupliquer le moteur
5. dériver un plan d'intégration minimaliste et incrémental
6. distinguer clairement :
   - reuse direct
   - adaptation légère
   - nouveau service nécessaire
   - obsolescence ou contournement

## 14. Statut de maturité

Le document peut être considéré comme suffisamment mature pour :

1. être figé comme document doctrinal de référence dérivée
2. servir de base à un mapping repo grounded par un autre agent
3. servir ensuite de base à un plan d'intégration incrémental sans réouvrir la doctrine
