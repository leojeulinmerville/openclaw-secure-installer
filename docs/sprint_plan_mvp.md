# Sprint Plan - MVP Strict (PostgreSQL Local)

Ce plan définit la trajectoire de build du socle missionnel en garantissant l'indépendance de la base de données vis-à-vis de Docker.

## Sprint 0 : Infrastructure Core & Runtime PG
**Objectif** : Bootstrap du moteur PostgreSQL local standard.

*   **Scope** :
    *   Setup du `Runtime Supervisor` Rust (gestion des binaires ZIP).
    *   Extraction, `initdb` et démarrage du service `postgres.exe` local.
    *   Initialisation du pool SQLx et premier Health Check.
    *   Schéma SQL minimal (Missions, Charters).
*   **Livrables** : Un backend Rust capable de garantir une instance PG saine sur localhost.
*   **Dépendances** : Binaires PostgreSQL Windows.
*   **Risques** : Conflits de ports et droits AppData.

## Sprint 1 : Coordinateur & Persistance
**Objectif** : Faire exister la mission comme objet métier persistant.

*   **Scope** :
    *   Migrations SQL complètes.
    *   Développement du `Mission Coordinator` (CRUD Missions/Contracts).
    *   API Tauri pour la gestion des missions.
*   **Livrables** : API interne persistante (sans interface UI avancée).

## Sprint 2 : Bridge CLI & Docker External
**Objectif** : Connecter le moteur d'exécution (CLI/Docker) au socle SQL.

*   **Scope** :
    *   Relier les runs CLI au coordinateur SQL local.
    *   Maintenir le pilotage de la Gateway via Docker Compose (Composant externe).
    *   Réconcilier les logs d'exécution CLI vers les tables de records SQL.
*   **Livrables** : Un run CLI alimente la base PostgreSQL locale.

## Sprint 3 : Mission Control UI & Final EXE
**Objectif** : Livraison du package installable zéro-config.

*   **Scope** :
    *   Interface Cockpit (React) lisant l'état PostgreSQL.
    *   Bundling final du `.exe` incluant les ressources runtime PG.
*   **Livrables** : Installateur Windows complet fonctionnel.

---

## Dépendances Runtime
- **Socle Missionnel** : PostgreSQL Local Standard (Natif).
- **Exécution & Gateway** : Docker Desktop (ou daemon local) recommandé pour les containers agents.
