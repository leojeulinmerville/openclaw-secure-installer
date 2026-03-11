# Mission Control & Agent Ops UI Design

Ce document définit les patterns d'interface recommandés pour transformer l'application Desktop actuelle en un véritable cockpit de supervision pour système autonome gouverné.

## 1. Du Chat à la Trajectoire (Changement de Paradigme)
*   **Pattern actuel (MVP)** : Un flux séquentiel de logs et de messages (style Chat/Terminal).
*   **Pattern cible (Mission Control)** : Une vue en "Gantt" ou en "Graphe" montrant la progression de la mission à travers ses phases (Framing, Planning, Execution, Review).
*   **Composant Clé** : **Mission Progress Map**. Une timeline interactive où chaque bloc représente un `Execution Contract` ou une `Transition Gate`.

## 2. L'Explorateur de Preuves (Evidence Explorer)
La confiance ne vient pas de la lecture des logs bruts, mais de la capacité à inspecter les `Evidence Bundles`.
*   **Pattern UI** : Cliquer sur une décision (ex: "Patch Applied") ouvre un volet latéral montrant :
    - Le **Claim** : "Ce patch corrige le bug X".
    - Les **Preuves** : Résultats de tests passés, logs de compilation, validation du `Performance Scorer`.
    - La **Responsabilité** : "Décidé par : Mission Governor (Niveau 2)".
*   **Progressive Disclosure** : Afficher d'abord la rationale (synthèse), puis permettre le "drill-down" vers les fichiers bruts.

## 3. Visualisation du Branching et Comparaison
Le système peut explorer plusieurs trajectoires. L'UI doit rendre cela lisible.
*   **Pattern UI : "Git-like" tree view**.
    - Afficher la **Trajectoire de Référence** (Main path).
    - Afficher les **Branches alternatives** (Explorations ou Recoveries) comme des bifurcations.
    - **Mode Comparaison** : Une vue "Diff" montrant les résultats (artefacts produits) de deux branches concurrentes pour aider l'humain à arbitrer.

## 4. Console d'Intervention Structurée
L'utilisateur ne doit pas juste "parler" à l'agent, il doit moduler le système.
*   **Types d'Interventions UI** :
    - **Pause/Freeze** : Arrêter une branche spécifique sans tuer la mission.
    - **Policy Override** : Autoriser exceptionnellement un appel réseau ou un dépassement de budget.
    - **Re-route** : Forcer le système à abandonner une branche et à en ouvrir une nouvelle sur une autre hypothèse.
    - **Correction d'Artefact** : Modifier directement un fichier produit pour "débloquer" l'agent.

## 5. Responsibility Ledger & Audit
Rendre visible la hiérarchie institutionnelle du système.
*   **Pattern UI : Badge de Responsabilité**.
    - Chaque événement dans l'UI porte une icône indiquant son niveau (N1 à N5).
    - Un filtre permet de voir uniquement les décisions de "Gouvernance" pour un audit rapide.

---

## Synthèse des Vues Clés de Mission Control

| Vue | Fonction | Public Cible |
| :--- | :--- | :--- |
| **Mission Dashboard** | Vue macro de toutes les missions actives, risques et budgets. | Superviseur |
| **Case File Explorer** | Navigation temporelle dans les preuves et les décisions. | Auditeur / Expert |
| **Live Workspace** | Vue interactive des fichiers en cours de mutation par les agents. | Opérateur |
| **Recovery Console** | Interface dédiée au diagnostic et à la reprise après Failure. | Debug Analyst |

## Recommandations d'implémentation (Tauri/React)
1.  **Graphe de Trajectoire** : Utiliser une bibliothèque comme `React Flow` ou `D3.js` pour rendre les branches de mission explorables.
2.  **State Projection** : Le backend Rust doit projeter un "UI State" simplifié (Ready for UI) pour éviter que le frontend ne doive recalculer la logique des branches.
3.  **Real-time Streaming** : Utiliser les événements Tauri (`emit`) pour mettre à jour la "Mission Map" en temps réel sans recharger le Case File.
