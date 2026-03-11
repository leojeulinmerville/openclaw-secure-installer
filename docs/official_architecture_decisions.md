# Official Architecture Decisions - OpenClaw MVP

Ce document récapitule les choix d'architecture définitifs pour le build de la version MVP.

| Décision | Statut | Portée | Impact |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Canonique Local** | **OFFICIEL** | Source de vérité unique pour l'état missionnel. | Abandon de SQLite pour le socle missionnel. Garantit la scalabilité du Case File. |
| **Zéro-Config Windows (.exe)** | **OFFICIEL** | Contrainte de distribution prioritaire. | L'installateur doit bootstrap automatiquement PostgreSQL sans action utilisateur. |
| **Rust/Tauri Runtime Supervisor** | **OFFICIEL** | Gestion du cycle de vie PG local. | Le backend Rust pilote `initdb` et `pg_ctl`. Pas de service Windows global requis. |
| **Docker non-obligatoire pour le socle** | **OFFICIEL** | Infrastructure de données. | PostgreSQL tourne nativement sur l'hôte. Docker n'est pas requis pour faire exister la mission. |
| **Docker conservé pour l'exécution** | **OFFICIEL** | Gateway et Containers Agents. | Docker reste l'environnement privilégié pour l'isolation des agents et la Gateway. |
| **Mission Coordinator (Persistence Hub)** | **OFFICIEL** | Couche logique de coordination. | Incarne l'autorité entre l'UI et le moteur d'exécution. |
| **Mission Control MVP** | **OFFICIEL** | Surface de supervision. | Première projection visuelle du Case File et du Responsibility Ledger. |

---

## Documents Superseded (Partiellement)
- Les documents de recherche suggérant SQLite comme option principale pour l'état canonique sont obsolètes sur ce point.
- Les documents suggérant PostgreSQL via Docker comme dépendance obligatoire du socle sont obsolètes.
