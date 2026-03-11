# Architecture Increments

Ce document décrit la trajectoire d'évolution architecturale pour combler le gap entre la réalité actuelle et la cible d'OpenClaw (système autonome gouverné).

## 1. Introduction of the Mission Daemon

**Observation factuelle**
L'orchestration passe par `async_runtime::spawn` dans Tauri, ce qui lie le cycle de vie du run à l'application Desktop de manière éphémère.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `tauri::async_runtime::spawn`
- route/command: Déclenchement de la CLI depuis le backend Rust.

**Risque ou limite**
Si l'UI Desktop est fermée, le processus est potentiellement interrompu ou son état perdu (impossibilité de "cold resume" élégant sur une tâche de fond longue). Pas de séparation entre le "Control Plane" (Desktop) et l'"Orchestration Plane".

**Opportunité d’évolution**
Extraire la logique d'orchestration dans un vrai service `src/daemon` (Node.js ou Rust autonome) ou un "Mission Control module" persistant. Ce démon gérerait le cycle complet de la mission (Intake, Exécution continue, Review), que le Desktop soit ouvert ou non.

**Niveau de confiance**
Élevé

## 2. Transition from events.jsonl to a Relational State Model

**Observation factuelle**
L'état d'un run et sa traçabilité reposent sur un fichier texte `events.jsonl` append-only, qui stocke tous les événements sans indexation structurée ni liens relationnels.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `get_run_events` / `_append_event`
- route/command: Fichiers locaux dans `runs/{run_id}/`

**Risque ou limite**
Le modèle append-only limite la capacité à implémenter un "Case File" riche, à relier une "Evidence" à un "Claim", ou à construire des arbres de décision complexes (Branching). Les requêtes de Mission Control (ex: "Montre-moi toutes les récupérations ayant échoué") seront inefficaces.

**Opportunité d’évolution**
Utiliser `sqlite-vec` (déjà présent dans le `package.json`) pour modéliser le "Case File", les "Contracts", les "Artifacts" et les "Branches". Cela permet l'interrogation structurée nécessaire à l'Audit Plane et à une UI Mission Control intelligente.

**Niveau de confiance**
Élevé

## 3. Implementing the Transition Governance Model

**Observation factuelle**
Les passages d'états (ex: approbation) sont codés en dur comme de simples branchements if/else, sans notion de "Gate" ou de "Policy" dynamique.

**Preuves repo**
- file: `desktop/src-tauri/src/runs.rs`
- function: `submit_approval`
- route/command: `if decision == "approved"`

**Risque ou limite**
Pas de gestion de dégradations dynamiques ("safe partial completion") ni de validation à granularité fine. Le système ne peut pas bloquer une promotion d'artefact en fonction d'une policy changeante.

**Opportunité d’évolution**
Créer un moteur de transitions (Transition Governance Model) où chaque passage d'état est intercepté par un "Governance Plane" local. Ce système évalue la demande de transition contre la policy active avant de l'autoriser ou de déclencher un Recovery.

**Niveau de confiance**
Moyen

## 4. Capability Registry & Lifecycle

**Observation factuelle**
Les extensions sont des dossiers statiques listés par l'API sans état de cycle de vie.

**Preuves repo**
- file: `src/gateway/server-plugins.ts`
- function: Chargement des extensions au boot de la Gateway.

**Risque ou limite**
Impossible d'ajouter à chaud une nouvelle capacité, de la mettre en quarantaine suite à un échec (Failure taxonomy), ou de mesurer son niveau de confiance (Capital Opératoire) au fil des runs.

**Opportunité d’évolution**
Construire une table `capabilities` en base de données qui gère le "Sourcing", "Evaluation", "Institutionnalisation", et "Retraite" de chaque outil ou pattern. Le Gateway/Daemon n'exécuterait que les capacités validées et actives.

**Niveau de confiance**
Moyen
