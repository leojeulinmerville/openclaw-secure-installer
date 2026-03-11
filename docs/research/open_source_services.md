# Services Open Source et Briques Techniques

Ce document identifie les composants open-source recommandés pour matérialiser les plans de responsabilité d'OpenClaw (Governance, Orchestration, Execution, Audit) définis dans `product_system_v2.md`.

## 1. Stockage, State & Evidence Store (Le Case File)
Le système a besoin d'un stockage relationnel pour le `Case File` et vectoriel pour la mémoire à long terme.
*   **Recommandation : SQLite + sqlite-vec**
    *   **Pourquoi** : Déjà présent dans le repo (`sqlite-vec`). Local, sans serveur, performant pour les recherches sémantiques sur les logs et les preuves.
    *   **Usage** : Stockage du `Responsibility Ledger`, des `Evidence Bundles` et des `Decision Records`.
*   **Alternative (Multi-nœuds) : PostgreSQL + pgvector**
    *   **Pourquoi** : Si la topologie "Central Daemon" est choisie pour un usage d'équipe.

## 2. Orchestration & Runtime (Le Workspace)
*   **Recommandation : Docker + gVisor (optionnel)**
    *   **Pourquoi** : Standard de facto. gVisor permet de renforcer l'isolation des `Execution Contracts` (Niveau 4) en interceptant les appels système.
    *   **Usage** : Isolation par mission/branche.
*   **Recommandation : Temporal.io (Self-hosted)**
    *   **Pourquoi** : Pour la résilience des missions longues (semaines/mois). Gère nativement les reprises après crash, les timeouts et les workflows complexes.
    *   **Usage** : Gestion du `Mission Cycle` (Phases 1 à 10).

## 3. Policy & Secret Management (Governance Plane)
*   **Recommandation : Open Policy Agent (OPA)**
    *   **Pourquoi** : Standard pour la "Policy-as-Code". Permet de définir les règles de `Risk Policy Manager` (Niveau 1) en langage Rego.
    *   **Usage** : Valider les `Transition Gates` avant toute action à haut risque.
*   **Recommandation : Infisical (Self-hosted) ou Mozilla SOPS**
    *   **Pourquoi** : Gestion sécurisée des secrets (API keys, Tokens Gateway) sans les exposer dans les logs d'audit.
    *   **Usage** : Remplacer le stockage en clair dans `.env`.

## 4. Observabilité & Audit (Audit Plane)
*   **Recommandation : OpenTelemetry (OTel) + Jaeger**
    *   **Pourquoi** : Standard industriel pour le traçage distribué. Permet de visualiser le cheminement d'une intention à travers les différents agents.
    *   **Usage** : Nourrir le `Run Auditor` et le `Drift Monitor` (Niveau 5).
*   **Recommandation : LangSmith (version locale/Lite) ou LangFuse**
    *   **Pourquoi** : Spécialisé dans l'observabilité des LLM (coûts, latence, scores de fidélité).
    *   **Usage** : Scoring de performance et évaluation de la qualité des opérateurs.

## 5. Capability Registry & Artifact Store
*   **Recommandation : MinIO (S3 compatible local)**
    *   **Pourquoi** : Stockage d'objets pour les `Working Artifacts` volumineux (images, builds, datasets).
    *   **Usage** : Artifact Store pour les preuves probatoires.
*   **Recommandation : MCP (Model Context Protocol)**
    *   **Pourquoi** : Standard d'Anthropic pour exposer des outils aux LLM.
    *   **Usage** : Format pivot pour le `Capability Registry`.

---

## Synthèse d'Intégration (Tech Stack Cible)

| Fonction | Brique Technique | Rôle dans OpenClaw |
| :--- | :--- | :--- |
| **Base de données** | SQLite / sqlite-vec | Mémoire vive, Case File, Evidence Store |
| **Workflow Engine** | Temporal / Node-RED | Orchestration des missions (N3) |
| **Policy Engine** | OPA (Rego) | Constitution et Gouvernance (N1/N2) |
| **Isolation** | Docker / gVisor | Execution Plane (N4) |
| **Trace/Audit** | OpenTelemetry / Jaeger | Audit & Apprentissage (N5) |
| **Registry** | MCP / SQLite | Capability Registry & Capital Opératoire |

## Prochaine étape : Priorisation
1.  **Immédiat** : Exploiter pleinement **SQLite/sqlite-vec** pour remplacer `events.jsonl`.
2.  **Moyen terme** : Introduire **OPA** pour formaliser les règles de sécurité du `Policies.tsx` actuel.
3.  **Cible** : Adopter **OpenTelemetry** pour une supervisabilité "utile" dans Mission Control.
