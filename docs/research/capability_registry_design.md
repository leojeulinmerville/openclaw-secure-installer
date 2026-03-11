# Capability Registry & Operational Capital Design

Ce document définit la logique de gestion du capital opératoire d'OpenClaw, permettant au système d'apprendre et d'institutionnaliser de nouvelles capacités de manière gouvernée.

## 1. Distinction Fondamentale
Pour éviter la pollution du système, OpenClaw doit distinguer :
*   **Mission Outputs** : Le code ou le document final demandé par l'utilisateur.
*   **Working Artifacts** : Scripts temporaires ou fichiers de tests créés pendant le run.
*   **Operational Capital** : Capacités (outils, patterns, connecteurs) validées, documentées et réutilisables pour des missions futures.

## 2. Structure du Capability Registry
Le registre n'est pas une simple liste d'extensions. Chaque capacité doit posséder un manifeste de gouvernance :

| Champ Métadonnée | Description | Rôle |
| :--- | :--- | :--- |
| **ID & Version** | Identifiant unique et version sémantique (SemVer). | Traçabilité |
| **Trust Level** | Niveau de confiance (Experimental, Qualified, Institutional). | Risque |
| **Capability Scope** | Dans quels contextes l'outil est-il sûr ? (ex: "local-files-only"). | Sécurité |
| **Failure History** | Taux d'échec constaté lors des derniers usages. | Fiabilité |
| **Governance Regime** | Nécessite-t-il une approbation humaine pour être invoqué ? | Contrôle |
| **Interface (MCP)** | Définition des entrées/sorties (standard Model Context Protocol). | Interopérabilité |

## 3. Le Cycle de Promotion de Capacité
Une capacité ne naît pas "institutionnelle". Elle suit un parcours gouverné :

1.  **Sourcing (Niveau 4)** : L'agent d'implémentation crée un outil local pour résoudre un problème immédiat.
2.  **Evaluation (Niveau 5)** : Le `Strategy Learner` détecte que cet outil a une valeur réutilisable et propose sa promotion.
3.  **Ratification (Niveau 2)** : Le `Mission Governor` (ou l'humain) valide l'entrée dans le registre après un audit de sécurité.
4.  **Institutionnalisation** : L'outil est packagé, ajouté au registre global et devient disponible pour tous les `Mission Planners`.

## 4. Gestion de la Dette de Capacité (Retrait)
Un système sain doit savoir "désapprendre".
*   **Politique de Retraite** : Toute capacité non utilisée pendant N missions ou présentant un taux d'échec > X% est automatiquement dépréciée.
*   **Versioning Stricte** : Le `Mission Planner` doit pouvoir demander une version spécifique d'une capacité pour garantir la reproductibilité des trajectoires.

## 5. Recommandations Techniques
*   **Format Pivot : MCP (Model Context Protocol)**. Adopter MCP comme format de base pour toutes les capacités permet à OpenClaw d'être compatible avec l'écosystème externe (Anthropic, IDEs, etc.).
*   **Stockage : SQLite**. Utiliser une table dédiée dans le `Case File` global pour stocker le catalogue des capacités actives.
*   **Documentation Auto-générée** : Le système doit maintenir une documentation technique (README/Types) pour chaque capacité afin que les LLM puissent les découvrir et les utiliser sans hallucination.

---

## Synthèse du Capital Opératoire par Type

| Type | Exemple | Gouvernance |
| :--- | :--- | :--- |
| **Technique** | Wrapper API, Script de refactoring Rust | Strict (Security Scan) |
| **Cognitif** | Pattern de diagnostic pour erreur Docker | Modéré (Audit Log) |
| **Gouvernance** | Protocole de validation pour déploiement | Très Strict (Niveau 1/2) |
| **Récupération** | Routine de rollback pour base de données | Moyen (Pre-tested) |

## Prochaine étape : Implémentation
1.  **MVP** : Créer un dossier `registry/` où chaque outil possède un fichier `.json` de métadonnées.
2.  **Moyen terme** : Intégrer un agent de "Discovery" qui propose à l'utilisateur de "sauvegarder cet outil" à la fin d'un run réussi.
