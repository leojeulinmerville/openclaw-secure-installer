# Gap Analysis vs Product Vision

Ce document confronte la réalité technique du repository actuel avec la vision cible du système autonome gouverné décrite dans `product_system_v2.md`.

## 1. Autonomie vs Orchestration Missionnelle

**Observation factuelle**
Le système actuel exécute des tâches ("Runs") en lançant un processus enfant isolé du CLI `openclaw` pour un cycle requête/réponse unique, sans véritable continuité de mission à long terme.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `real_run_execution`
- route/command: `Command::new(&cmd_bin).arg("agent")...`

**Risque ou limite**
L'absence d'un coordinateur de mission ("Mission Planner" / "Task Router") empêche le système de s'auto-réguler, de gérer des branches multiples, ou d'appliquer la boucle continue de contrôle (Phase 6 du cycle missionnel) sans l'intervention directe du code UI. Le run vit et meurt avec son appel CLI.

**Opportunité d’évolution**
Remplacer le simple appel sous-processus par un véritable "Mission Control Daemon" (potentiellement en Rust ou Node.js) capable de maintenir le cycle de vie d'une `Mission Charter` et d'un `Case File` en mémoire, orchestrant de multiples interactions avec les agents sans bloquer l'interface.

**Niveau de confiance**
Élevé

## 2. Hiérarchie des Responsabilités (Les 5 Niveaux)

**Observation factuelle**
La séparation en cinq niveaux (Policy, Gouvernance, Orchestration, Opérateurs, Audit) n'existe pas structurellement dans la codebase. Le CLI rassemble actuellement les rôles de planification et d'exécution au sein du même agent.

**Preuves repo**
- file: `src/agents/` (Dossier contenant l'implémentation des agents)
- function: L'architecture actuelle du CLI `pi-agent-core` (d'après `package.json`).

**Risque ou limite**
Sans séparation partielle des pouvoirs, le système ne peut pas appliquer le principe de subsidiarité de la cible. Un agent qui génère du code est le même qui s'auto-valide, rendant impossible la mise en place de "Evaluation Contracts" fiables.

**Opportunité d’évolution**
Découper les appels CLI pour invoquer des "Opérateurs spécialisés" distincts (ex: `--role=coder`, `--role=reviewer`). Insérer une couche d'Orchestration Tactique côté Desktop ou Gateway pour arbitrer leurs retours avant de consolider la trajectoire.

**Niveau de confiance**
Élevé

## 3. Preuves Structurées (Evidence Bundles) et Traceabilité

**Observation factuelle**
La traçabilité d'un run est actuellement gérée par un simple log append-only d'événements séquentiels, sans notion de "Claim", de "Preuve" ou de "Contre-preuve".

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `_append_event`
- storage: `events.jsonl`

**Risque ou limite**
Il est impossible pour l'utilisateur de valider intelligemment une étape (Validation progressive) si la plateforme ne lui offre qu'un flux de texte brut. La reprise après crash ("Recovery") manque de contexte canonique.

**Opportunité d’évolution**
Transformer `events.jsonl` en une base de données locale (`sqlite-vec` est déjà dans `package.json`) modélisant les `Evidence Items` et les `Evidence Bundles`, permettant à l'UI de requêter "Pourquoi cette décision a-t-elle été prise ?" avec des pointeurs précis.

**Niveau de confiance**
Élevé

## 4. Gouvernance et Capital Opératoire (Capability Registry)

**Observation factuelle**
Les capacités du système (outils, channels, providers) sont chargées statiquement au démarrage depuis un dossier d'extensions, sans cycle de vie explicite, politique de retraite ou qualification de confiance.

**Preuves repo**
- file: `src/gateway/capabilities-http.ts` et le dossier `extensions/`
- route/command: `/api/v1/capabilities`

**Risque ou limite**
L'ajout non gouverné de nouvelles capacités créera de la "capability debt". Le système ne sait pas distinguer une heuristique jetable d'un moyen durable (Capital Opératoire) qualifié pour des missions à haut risque.

**Opportunité d’évolution**
Créer un véritable "Capability Registry" persistant. Chaque extension devra posséder un cycle de vie (candidate, active, dépréciée) et un niveau de confiance, modifiables via une interface de gouvernance.

**Niveau de confiance**
Moyen

## 5. Gestion des Interventions et de l'Échec (Failure Taxonomy)

**Observation factuelle**
Les interventions humaines se limitent à "Approuver / Rejeter" un patch, et les erreurs terminent le run brutalement avec un statut de "Failed".

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `submit_approval` et le bloc `match execute_command_streaming`

**Risque ou limite**
Le système manque de "Recovery Model". Une erreur de validation d'un outil entraîne l'arrêt de la mission plutôt qu'une tentative de containment, reroute ou replanification proportionnée.

**Opportunité d’évolution**
Remplacer le booléen d'approbation par un système canonique d'"Interventions" (consultatives, bloquantes, override) et implémenter des hooks de "Recovery" dans le coordinateur de run pour tester différentes stratégies (retry, repair) avant d'escalader à l'humain.

**Niveau de confiance**
Élevé
