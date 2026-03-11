spec_case_file_canonical_state_minimal
1. Objet de la spec

Cette spec définit le noyau minimal d’état canonique nécessaire pour faire exister une mission persistante gouvernée dans le produit cible.

Elle ne décrit pas encore toute la cible V2 complète. Elle définit le plus petit ensemble cohérent d’objets, de relations, d’états et de projections permettant de sortir du modèle actuel centré sur des runs éphémères et des logs dispersés.

Son but est de répondre à une question simple :

quel est le minimum à construire pour qu’une mission existe comme objet persistant, gouvernable, reprenable et supervisable ?

Cette spec sert donc de fondation pour :
la persistance missionnelle
la reprise
la projection Mission Control minimale
la traçabilité des décisions principales
la future gouvernance de trajectoire

2. But produit

À la fin de cette première couche, le système doit être capable de :

recevoir une intention et créer une mission persistante
stocker un état missionnel canonique indépendant du seul run en cours
conserver une trajectoire de référence minimale
savoir quels objets sont actifs, bloqués, validés ou clôturés
reprendre une mission après interruption sans relire tout le brut
afficher dans Mission Control une vue simple mais fiable de l’état courant
enregistrer au moins les décisions et transitions significatives
supporter ensuite les couches supérieures : evidence, recovery, branching, capability registry

3. Principe général

Le système ne doit plus considérer le run comme l’unité principale de vérité.

Le run devient une activation opérationnelle.
La vérité canonique minimale doit être portée par un ensemble d’objets persistants centrés sur la mission.

La structure minimale retenue est :

Mission
Mission Charter
Case File
Mission State Projection
Contracts minimaux
Artifacts minimaux
Decision Records minimaux
Validation Records minimaux
Resume Snapshot minimal

À ce stade, on ne cherche pas encore à modéliser toute la richesse finale.
On cherche à construire le plus petit noyau cohérent qui permette une mission vivante.

4. Objets minimaux à créer
4.1 Mission

La Mission est l’objet racine.

Elle représente l’existence persistante d’une unité de travail gouvernée.
Elle ne se réduit ni à un run, ni à un prompt, ni à un chat, ni à un workspace.

Champs minimaux recommandés :

mission_id
title
created_at
updated_at
status
mission_mode
current_reference_path_id
current_phase
current_governance_state
current_health_state
resume_readiness
last_resume_at
active_run_id nullable
summary_current
risk_level_initial
risk_level_current

Rôle :
point d’entrée principal pour la persistance, la supervision et la reprise.

4.2 Mission Charter

La Mission Charter porte le mandat de haut niveau.

Elle ne doit pas être dissoute dans un champ texte libre.
Elle doit exister comme objet lié à la Mission.

Champs minimaux recommandés :

charter_id
mission_id
intent_raw
intent_interpreted
goal_statement
constraints json/text
acceptance_criteria_high_level
scope_statement
initial_mode
policy_profile
created_at
updated_at
version

Rôle :
fixer ce que la mission cherche à accomplir et sous quelles contraintes.

4.3 Case File

Le Case File est le dossier vivant de la mission.

À ce stade minimal, il ne doit pas déjà devenir une encyclopédie.
Mais il doit déjà porter la continuité utile.

Champs minimaux recommandés :

case_file_id
mission_id
status
open_questions json/text
active_risks json/text
pending_obligations json/text
recent_inflection_points json/text
current_summary
current_next_best_action
last_consolidated_at
freshness_state

Rôle :
agréger le contexte vivant nécessaire à la reprise et à la supervision.

4.4 Mission State Projection

Cet objet peut être une table dédiée ou une projection dérivée persistée.
Dans le MVP, je recommande une projection persistée simple.

Elle sert de vue canonique rapide pour Mission Control et pour la reprise machine.

Champs minimaux recommandés :

mission_id
reference_path_label
phase
status
health_state
governance_state
top_blocker
top_risk
current_focus
last_significant_decision_id
last_significant_validation_id
last_significant_transition_at
resume_readiness
needs_human_attention boolean
updated_at

Rôle :
offrir une lecture courte et fiable de l’état courant sans relire tous les objets liés.

4.5 Contracts minimaux

On ne modélise pas encore toute la taxonomie riche, mais il faut déjà un objet Contract.

Champs minimaux recommandés :

contract_id
mission_id
parent_contract_id nullable
contract_type
title
objective
status
health_state
governance_state
assigned_role
branch_id nullable
input_summary
expected_output_summary
acceptance_summary
created_at
updated_at
completed_at nullable

Types minimaux à supporter dès le départ :
execution
evaluation
decision
observation

Le learning peut arriver plus tard si besoin.

Rôle :
faire exister le travail missionnel comme unités gouvernables.

4.6 Artifacts minimaux

Il faut dès le départ pouvoir rattacher des outputs à la mission.

Champs minimaux recommandés :

artifact_id
mission_id
origin_contract_id nullable
artifact_type
name
location_ref
status
promotion_state
summary
created_at
updated_at
version_label

Rôle :
porter les sorties produites ou modifiées, même dans un MVP.

4.7 Decision Records minimaux

Sans décision persistée, pas de gouvernance réelle.

Champs minimaux recommandés :

decision_id
mission_id
related_contract_id nullable
related_artifact_id nullable
decision_type
claim_summary
decision_outcome
decision_rationale_summary
responsibility_level
responsibility_role
control_mode
created_at

Rôle :
journaliser les décisions significatives liées à la mission.

4.8 Validation Records minimaux

Même logique pour la validation.

Champs minimaux recommandés :

validation_id
mission_id
related_contract_id nullable
related_artifact_id nullable
validation_scope
validation_outcome
validation_summary
confidence_level
responsibility_level
responsibility_role
created_at

Rôle :
faire exister les jugements d’acceptabilité en dehors du seul log d’exécution.

4.9 Resume Snapshot minimal

Même si la reprise complète sera enrichie plus tard, il faut dès le départ un snapshot minimal dédié.

Champs minimaux recommandés :

resume_snapshot_id
mission_id
snapshot_summary
reference_path_state
current_phase
pending_obligations_summary
open_risks_summary
top_objects_summary
next_action_summary
resume_mode_recommended
created_at

Rôle :
permettre une reprise simple, rapide, gouvernable.

5. Relations minimales entre objets

Le système doit au minimum supporter les relations suivantes :

Une Mission possède une Mission Charter.
Une Mission possède un Case File.
Une Mission possède plusieurs Contracts.
Une Mission possède plusieurs Artifacts.
Une Mission possède plusieurs Decision Records.
Une Mission possède plusieurs Validation Records.
Une Mission possède plusieurs Resume Snapshots.
Un Contract peut produire ou modifier plusieurs Artifacts.
Un Contract peut être lié à des Decision Records et Validation Records.
Le Case File consolide la vision vivante de la Mission à partir de ces objets.

Il n’est pas nécessaire au MVP de tout normaliser parfaitement.
Mais ces relations doivent être conceptuellement respectées.

6. États minimaux à supporter
6.1 Mission status minimal

Je recommande ce minimum :

draft
framed
active
paused
escalated
completed
aborted
archived

6.2 Contract status minimal

proposed
admitted
running
blocked
under_review
validated
failed
completed
cancelled

6.3 Artifact status minimal

draft
generated
in_review
validated
accepted
rejected
archived

6.4 Health state minimal

Pour Mission et Contracts au moins :

stable
degraded
critical

6.5 Governance state minimal

normal
under_review
escalated
guarded

Ce n’est pas encore toute la richesse finale, mais c’est déjà suffisant pour porter un vrai système.

7. Transitions minimales à tracer

Il faut tracer explicitement au minimum :

création de mission
framing validé
activation de mission
admission de contrat
lancement de contrat
validation ou rejet de contrat
génération d’artefact
promotion d’artefact à accepted
passage en paused
passage en escalated
clôture completed ou aborted
création de resume snapshot

Ces transitions doivent être reliées à :
un timestamp
un niveau de responsabilité
un rôle logique
et idéalement un court résumé de rationale

Même sans moteur de transitions avancé, cette discipline doit exister dès le départ.

8. Projection minimale pour Mission Control

Mission Control MVP ne doit pas lire tout le graphe objet brut.
Il doit pouvoir lire une projection simple.

Je recommande qu’il puisse afficher, pour une mission :

titre
mode de mission
phase actuelle
status
health state
governance state
trajectoire de référence
focus courant
top blocker
top risk
contrats actifs
artefacts récents
dernière décision significative
dernière validation significative
resume readiness
besoin d’attention humaine oui/non

Cette projection doit provenir d’un état canonique ou d’une projection persistée, pas d’un calcul fragile ad hoc uniquement basé sur les logs.

9. Ce que cette spec ne couvre pas encore

Cette spec ne couvre pas encore en détail :

le branching complet
l’evidence model riche
les committees détaillés
les interventions complètes
le recovery model riche
le capability registry complet
les policy engines avancés
les modes de mission détaillés
les topologies multi machine

Ils viendront ensuite, mais sur ce noyau.

10. Décision de stockage recommandée

Pour cette spec, la recommandation d’architecture est :

PostgreSQL comme source de vérité canonique
et non SQLite comme vérité centrale

Justification :
le noyau à construire commence déjà à ressembler à un vrai système transactionnel avec relations, transitions, reprises et records gouvernés.
PostgreSQL est plus adapté à cette ambition.

11. Critère de réussite de cette spec

Cette spec sera considérée comme correctement implémentée quand le système pourra, au minimum :

créer une mission persistante
lui attacher une charter
lui attacher un case file
créer des contracts reliés
créer des artifacts reliés
journaliser décisions et validations significatives
produire une projection Mission Control minimale
reprendre une mission après arrêt sans dépendre uniquement des logs bruts

12. Conséquence directe

Une fois cette spec validée, la suite logique est :
écrire la spec 2,
Mission Coordinator / Embedded Hybrid,
qui dira comment ces objets sont alimentés, mis à jour et orchestrés par le moteur.
