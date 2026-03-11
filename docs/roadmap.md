# Roadmap de Transformation OpenClaw V2

Ce document présente la trajectoire chronologique recommandée pour transformer le MVP actuel d'OpenClaw en un système autonome gouverné complet, en s'appuyant sur les recherches techniques menées dans `docs/research/`.

## Phase 1 : Consolidation du Socle (Fondations & Persistance)
**Objectif** : Passer d'un modèle de logs éphémères à un modèle de données relationnel et probatoire.

*   **Sprint 1.1 : Le Case File (SQLite)**
    *   Remplacer `events.jsonl` par une base SQLite structurée.
    *   Implémenter le schéma initial pour le `Case File`, les `Evidence Items` et le `Responsibility Ledger`.
    *   *Référence* : `docs/research/open_source_services.md`.
*   **Sprint 1.2 : Persistence Hub**
    *   Déplacer la gestion de l'état (State) du frontend React vers le backend Rust (Tauri).
    *   Implémenter le "Hot Resume" : capacité de réhydrater une mission après redémarrage de l'app.
    *   *Référence* : `docs/architecture_increments.md`.

## Phase 2 : Orchestration Tactique (Le Mission Daemon)
**Objectif** : Découpler l'intelligence d'orchestration de l'interface graphique.

*   **Sprint 2.1 : Mission Planner & Registry**
    *   Extraire la logique de planification des agents du CLI vers un module d'Orchestration (Niveau 3).
    *   Implémenter la `Mission Charter` comme objet de cadrage autoritaire.
    *   *Référence* : `docs/research/infra_topology.md`.
*   **Sprint 2.2 : Multi-Model Routing**
    *   Permettre l'utilisation de modèles différents selon le rôle (ex: Llama-3-70B pour le jugement, Qwen-Coder pour l'exécution).
    *   Intégration native de plusieurs instances Ollama/VLLM.
    *   *Référence* : `docs/research/model_mapping.md`.

## Phase 3 : Gouvernance Réelle (Policy & Gates)
**Objectif** : Remplacer les éléments "mockés" par une logique de contrôle active.

*   **Sprint 3.1 : Policy Enforcement (OPA)**
    *   Intégrer un moteur de règles (type OPA) pour valider les transitions (Niveau 1/2).
    *   Rendre fonctionnelle la page "Policies" (Egress allowlist dynamique, Cost Caps réels).
    *   *Référence* : `docs/research/open_source_services.md`.
*   **Sprint 3.2 : Transition Gates & Approvals**
    *   Implémenter les points de contrôle structurés avant les actions à haut risque (ex: déploiement).
    *   Remplacer le simple bouton "Approve" par une console d'"Interventions" structurées.
    *   *Référence* : `docs/research/mission_control_design.md`.

## Phase 4 : Mission Control (Supervisabilité Utile)
**Objectif** : Offrir une interface de cockpit permettant de naviguer dans la complexité du système.

*   **Sprint 4.1 : Trajectory Map**
    *   Visualisation graphique de la mission (Graphe de branches, timeline de phases).
    *   Affichage des "Evidence Bundles" liés à chaque décision.
    *   *Référence* : `docs/research/mission_control_design.md`.
*   **Sprint 4.2 : Branching & Recovery UI**
    *   Interface de comparaison entre trajectoires concurrentes.
    *   Console dédiée au diagnostic de failure et au choix de stratégies de récupération.

## Phase 5 : Capital Opératoire & Apprentissage
**Objectif** : Permettre au système de s'améliorer durablement (Niveau 5).

*   **Sprint 5.1 : Capability Registry (MCP)**
    *   Adopter le standard Model Context Protocol pour toutes les extensions.
    *   Mettre en place le cycle de promotion de capacité (Local -> Qualified -> Institutional).
    *   *Référence* : `docs/research/capability_registry_design.md`.
*   **Sprint 5.2 : Run Audit & Strategy Learning**
    *   Implémenter l'agent d'audit post-mission pour extraire les patterns de succès/échec.
    *   Mise à jour automatique des heuristiques d'orchestration.

---

## Résumé de la Trajectoire

| Phase | Horizon | Risque Principal | Valeur Produit |
| :--- | :--- | :--- | :--- |
| **P1: Fondations** | Court terme | Migration des données | Fiabilité & Reprise (Resume) |
| **P2: Orchestration** | Court terme | Latence multi-modèles | Autonomie prolongée |
| **P3: Gouvernance** | Moyen terme | Complexité des règles | Sécurité & Confiance |
| **P4: Mission Control** | Moyen terme | UX chargée | Supervisabilité utile |
| **P5: Apprentissage** | Long terme | Drift cognitif | Scalabilité & Rétention de savoir |

## Prochaine Action Recommandée
Démarrer le **Sprint 1.1** : Définition du schéma SQLite pour le `Case File` et migration des événements de `events.jsonl` vers une table relationnelle.
