# MVP vs Target Mapping

Ce document détaille le chemin de transition entre la base de code actuelle (MVP) et la vision produit cible (Système autonome gouverné).

## 1. Exécution de Mission (Mission Cycle)

**Observation factuelle**
Dans le MVP, un "Run" équivaut à un seul appel à la CLI `openclaw agent ...`, qui boucle en interne jusqu'à ce que la tâche soit considérée terminée.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `real_run_execution`
- route/command: `run_cmd.arg("agent")...`

**Risque ou limite**
L'interface UX (inspirée du chat) et l'architecture backend figent l'exécution dans une logique conversationnelle ou mono-tâche. Il est impossible de définir une trajectoire à branches (Branching Model) ou de faire intervenir un comité de validation (Evaluation Contracts).

**Opportunité d’évolution**
- **MVP (Immédiat)** : Maintenir le CLI, mais découper le "Run" de l'interface en phases explicites (Intake, Plan, Execute, Review).
- **Moyen terme** : Créer un objet `MissionCharter` persistant. Au lieu d'un appel CLI géant, le coordinateur fait plusieurs appels spécialisés (`--role=planner`, `--role=coder`).
- **Cible** : Implémentation complète du Mission Control où les `Opérateurs Spécialisés` (Niveau 4) sont instanciés à la volée par l'`Orchestration Tactique` (Niveau 3).

**Niveau de confiance**
Élevé

## 2. Policy et Gouvernance de la Sécurité

**Observation factuelle**
La gouvernance dans le MVP se résume à une UI statique "Policies.tsx" et à une coupure réseau au niveau du conteneur Docker (openclaw-egress) définie lors du setup.

**Preuves repo**
- file: `desktop/src/pages/Policies.tsx`
- function: `set_allow_internet` dans `desktop/src-tauri/src/state_manager.rs`

**Risque ou limite**
Les promesses de sécurité de l'interface (Capabilities Dropped, Cost Caps) ne sont pas injectées dans la boucle de décision cognitive de l'agent. Si un "tool" contourne ces règles sans passer par Docker, il n'est pas bloqué par la "Policy".

**Opportunité d’évolution**
- **MVP (Immédiat)** : Écrire un fichier `policy.json` géré par Tauri et lu par la CLI OpenClaw avant chaque appel d'outil (vérification locale des permissions).
- **Moyen terme** : Connecter l'UI des Cost Caps (aujourd'hui mockée) à un vrai traqueur d'usage par Run et par Modèle.
- **Cible** : Un vrai "Policy Plane" (Niveau 1 de la cible) qui valide à chaud (Gate) chaque "Demande de transition" (ex: déploiement ou appel externe).

**Niveau de confiance**
Élevé

## 3. Registre de Capacités (Capability Registry)

**Observation factuelle**
Le MVP charge les capacités (providers, channels, plugins) en lisant simplement le contenu d'un dossier (`extensions/`) au démarrage.

**Preuves repo**
- file: `src/gateway/server-plugins.ts`
- directory: `extensions/`

**Risque ou limite**
Les outils sont codés en dur sans notion de versioning, de fiabilité, ou de cycle de vie (Capability Lifecycle). Cela contredit l'idée de "Capital Opératoire" réutilisable et gouverné.

**Opportunité d’évolution**
- **MVP (Immédiat)** : Ajouter un manifeste `capability.schema.json` pour chaque extension avec des métadonnées de gouvernance (risque, blast radius).
- **Moyen terme** : Implémenter une table `capabilities` dans la base SQLite locale pour tracer l'historique d'usage (combien de fois ce plugin a causé un Failure).
- **Cible** : Création d'un "Learning Contract" où l'Audit (Niveau 5) propose de promouvoir une action ad-hoc réussie en nouvelle "Capacité" durable dans le registre.

**Niveau de confiance**
Moyen

## 4. Persistance et Reprise (Continuity)

**Observation factuelle**
Le MVP gère l'état via l'interface React et quelques fichiers `.json`/`.jsonl` locaux. S'il y a une erreur technique, l'état du Run devient `Failed`.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `update_run_status`

**Risque ou limite**
Il n'existe pas de "Resume Readiness Profile". On ne peut pas mettre le travail en pause "proprement" (Freeze) et le reprendre plus tard (Hot/Cold Resume) depuis un checkpoint garanti.

**Opportunité d’évolution**
- **MVP (Immédiat)** : Sauvegarder des "Checkpoints" (snapshots des dossiers de travail et de l'historique des requêtes LLM).
- **Moyen terme** : Remplacer l'état `Failed` binaire par la "Failure Taxonomy" (technical, validation, alignment...) pour afficher pourquoi ça bloque.
- **Cible** : Modélisation complète du `Case File` en base de données permettant un "Forensic Resume" (reprise avec audit visuel complet) par l'utilisateur via Mission Control.

**Niveau de confiance**
Élevé
