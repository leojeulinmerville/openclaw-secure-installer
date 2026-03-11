# Topologies Infra Cibles

Ce document compare différentes architectures de déploiement pour OpenClaw, en passant du modèle actuel (Desktop + CLI éphémère) vers un système autonome gouverné capable de tourner en tâche de fond.

## 1. Topologie Actuelle : "Sidecar Desktop" (MVP)
*   **Structure** : L'application Desktop (Tauri) est le parent. Elle lance la Gateway (Docker Compose) et invoque le CLI (Child Process) à la demande.
*   **Avantages** : Installation simple, isolation Docker pour la Gateway.
*   **Inconvénients** : Le cycle de vie de la mission est lié à la fenêtre Desktop. Si le Desktop ferme, l'orchestration s'arrête. Pas de persistence de l'intelligence d'orchestration.

---

## 2. Topologie A : "Central Daemon" (Homelab / Pro)
Cette topologie sépare l'intelligence (Orchestration) de l'interface (Control Plane).

*   **Architecture** :
    *   **OpenClaw Daemon** : Un service persistant (Node.js ou Rust) qui tourne en arrière-plan (systemd, Docker, ou service Windows). Il gère le `Case File` et le `Mission Planner`.
    *   **Gateway** : Service Docker séparé, géré par le Daemon.
    *   **Desktop App** : Devient un pur client (Mission Control UI) qui se connecte au Daemon via WebSocket/gRPC.
*   **Cas d'usage** : Utilisateurs avancés, serveurs personnels (Homelab), instances 24/7.
*   **Briques** : Redis ou SQLite (State), Docker (Runtime).

## 3. Topologie B : "Multi-Worker Isolation" (Security-First)
Ici, chaque niveau de responsabilité (Gouvernance, Opérateur) tourne dans un environnement isolé.

*   **Architecture** :
    *   **Orchestrateur** : Tourne dans un conteneur privilégié.
    *   **Workers (Opérateurs)** : Tournent dans des conteneurs "Sandboxed" (gVisor ou Docker sans privilèges) avec des réseaux distincts.
    *   **Policy Enforcement Point** : Un proxy (type Envoy ou middleware Gateway) qui intercepte tous les appels LLM et Tooling pour vérifier les `Policy Contracts`.
*   **Cas d'usage** : Production logicielle sensible, agents avec accès internet restreint.
*   **Briques** : Docker Network, mTLS inter-services.

## 4. Topologie C : "Embedded Hybrid" (Cible Desktop Mature)
Le meilleur compromis pour une application Desktop qui "travaille pour vous" même quand vous ne la regardez pas.

*   **Architecture** :
    *   **Tauri Backend** : Ne se contente pas de lancer des commandes ; il intègre le `Mission Controller` comme un thread de fond persistant.
    *   **SQLite Local** : Base unique pour les missions, le capital opératoire et les traces.
    *   **Worker Pool** : Le système maintient un pool de processus CLI réutilisables pour éviter le coût de démarrage de Node.js à chaque tour.
*   **Cas d'usage** : Installation "One-click" sur Windows/Mac avec capacités d'autonomie.

---

## Synthèse Comparative

| Critère | Sidecar (MVP) | Central Daemon | Multi-Worker | Embedded Hybrid |
| :--- | :--- | :--- | :--- | :--- |
| **Simplicité d'installation** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| **Autonomie (24/7)** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Gouvernance/Isolation** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance (Latence)** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Persistence (Resume)** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

## Recommandations pour l'évolution d'OpenClaw

### Phase 1 : Migration vers "Embedded Hybrid" (Desktop)
L'étape la plus réaliste est de transformer le backend Rust de Tauri en un véritable coordinateur. 
- **Action** : Déplacer la logique de `runs.rs` vers un gestionnaire de file d'attente (Queue) persistant dans le backend Rust.
- **Brique** : Utiliser SQLite pour synchroniser l'état entre le Rust (Orchestrateur) et l'UI.

### Phase 2 : Option "Headless Daemon"
Permettre au moteur de tourner sans la partie graphique (CLI `--daemon`).
- **Action** : Rendre le code d'orchestration (Niveau 3) agnostique de Tauri pour qu'il puisse tourner dans un conteneur Docker "Headless".

### Phase 3 : Isolation Réseau stricte
Généraliser l'usage de réseaux Docker différents par mission.
- **Action** : Le `Mission Planner` crée un réseau Docker temporaire par `Mission Charter` pour isoler les artefacts et les accès internet.
