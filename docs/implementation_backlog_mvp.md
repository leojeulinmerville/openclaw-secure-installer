# Implementation Backlog - MVP Strict (PostgreSQL Local)

Ce backlog définit les tâches prioritaires pour implémenter le noyau missionnel persistant. PostgreSQL local standard est la source de vérité unique pour l'état canonique.

## Epic 0 : Runtime Bootstrap (PostgreSQL Standard Windows)
**Objectif** : Faire tourner PostgreSQL nativement sur Windows sans dépendance à Docker pour le stockage canonique.

### Tasks :
1.  **Provisioning des binaires PG** : Intégrer les binaires PostgreSQL (format zip minimal) dans les ressources de l'application.
    - *Fichiers* : `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/resources/`.
2.  **Supervisor de Runtime (Rust)** : Développer le module de pilotage des processus natifs.
    - *Sous-tâches* : Extraction des binaires dans AppData, exécution de `initdb.exe` (au premier boot), gestion de `pg_ctl.exe` (start/stop).
    - *Fichiers* : `desktop/src-tauri/src/runtime_pgsql.rs` (à créer).
3.  **Port & Instance Management** : Détection de port libre (priorité 5432) et isolation par dossier de données local.
4.  **Health Check & Pool SQLx** : Initialisation du pool de connexions Rust vers l'instance locale et vérification de la disponibilité.
    - *Fichiers* : `desktop/src-tauri/src/db.rs` (à créer).

## Epic 1 : Socle de Données Canonique (Schéma SQL)
**Objectif** : Modéliser la mission et ses objets.

### Tasks :
1.  **Schéma Missions & Case Files** : Migration pour les tables `missions`, `charters`, `case_files`.
2.  **Schéma Execution & Audit** : Migration pour les tables `contracts`, `artifacts`, `decision_records`, `validation_records`.
3.  **Projections & Continuity** : Tables `mission_state_projections` et `resume_snapshots`.

## Epic 2 : Mission Coordinator (Coordination Persistante)
**Objectif** : Autorité centrale de coordination intégrée au backend Rust.

### Tasks :
1.  **Service Coordinator** : Logique métier en Rust pour manipuler les objets en base.
2.  **API Tauri Commands** : `create_mission`, `list_missions`, `get_mission_details`.
3.  **Bridge avec le moteur existant** : Relier les activations CLI au coordinateur.

## Epic 3 : Bridge Exécution & Docker (Composants Externes)
**Objectif** : Maintenir la compatibilité avec le reste du système (Gateway, Agents).

### Tasks :
1.  **Liaison Gateway (Docker)** : S'assurer que l'app Desktop continue de piloter la Gateway via Docker Compose (inchangé).
2.  **Isolation Agents (Docker)** : Les agents de production continuent de tourner dans leurs containers Docker respectifs.
3.  **Réconciliation** : Le coordinateur central (PostgreSQL local) intercepte les signaux venant des containers/CLI pour mettre à jour l'état canonique.

---

## Risques Spécifiques (Runtime PG Local)
- **Permissions Windows** : Droits d'exécution des binaires PG dans le dossier `AppData`.
- **Zombies** : Risque que `postgres.exe` ne s'arrête pas si l'application crash (nécessite un check au boot).
- **Antivirus** : Faux positifs lors de l'extraction des binaires PG par l'EXE.

## Critères de Done (MVP)
1. Le `.exe` Windows installe et lance PostgreSQL nativement sans config manuelle.
2. L'état des missions est persisté dans PostgreSQL local (et non en SQLite ou Docker).
3. Le backend Rust supervise le cycle de vie du serveur de base de données.
