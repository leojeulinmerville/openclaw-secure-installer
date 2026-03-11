# Sprint 0 Execution Plan - PostgreSQL Infrastructure

Ce document détaille les étapes techniques pour le bootstrap du runtime PostgreSQL local et la mise en place du socle de données canonique pour OpenClaw MVP.

## Objectif global
Établir un environnement PostgreSQL local supervisé par le backend Rust/Tauri, capable de persister les objets missionnels fondamentaux sans aucune intervention manuelle de l'utilisateur.

---

## Sous-bloc A : Runtime PostgreSQL Local (Supervisor)
**Responsabilité** : Gérer les binaires natifs et le cycle de vie du processus serveur.

*   **Fichiers à créer/modifier** :
    *   `desktop/src-tauri/src/runtime_pgsql.rs` (CRÉATION) : Logique d'extraction (zip), `initdb`, `pg_ctl start/stop`.
    *   `desktop/src-tauri/resources/` (AJOUT) : Binaires PostgreSQL 16+ minimalistes pour Windows (zip).
    *   `desktop/src-tauri/tauri.conf.json` (MODIF) : Déclaration des ressources binaires pour le bundling.
*   **Dépendances** : `tauri-plugin-fs`, `tokio::process`, `zip-rs` (pour l'extraction).
*   **Critères de Done** :
    *   Au lancement, l'app extrait les binaires si absents dans `AppData`.
    *   `initdb` est exécuté avec succès au premier démarrage.
    *   Le processus `postgres.exe` est lancé et tourne en local sur un port dédié.

## Sous-bloc B : Connexion applicative et SQLx
**Responsabilité** : Créer le pont entre Rust et PostgreSQL.

*   **Fichiers à créer/modifier** :
    *   `desktop/src-tauri/Cargo.toml` (MODIF) : Ajout de `sqlx` avec les features `postgres`, `runtime-tokio`, `macros`.
    *   `desktop/src-tauri/src/db.rs` (CRÉATION) : Initialisation du pool SQLx, health check de la connexion.
*   **Dépendances** : `sqlx`, `tokio`.
*   **Critères de Done** :
    *   Le backend Rust établit une connexion stable avec le serveur local.
    *   Un "Health Check" DB est vert au démarrage de l'application.

## Sous-bloc C : Schéma Minimal Canonique
**Responsabilité** : Définir la structure de données pour la Mission.

*   **Fichiers à créer/modifier** :
    *   `desktop/src-tauri/migrations/` (CRÉATION) : Fichiers SQL de migration.
    *   `desktop/src-tauri/migrations/20260311000000_init_core.sql` : Tables `missions` et `mission_charters`.
*   **Critères de Done** :
    *   Les tables sont créées automatiquement via `sqlx::migrate!`.
    *   La base `openclaw_canonical` contient les colonnes minimales définies dans la spec.

## Sous-bloc D : Intégration Superviseur Tauri
**Responsabilité** : Intégrer le lifecycle DB dans celui de l'application Desktop.

*   **Fichiers à créer/modifier** :
    *   `desktop/src-tauri/src/main.rs` (MODIF) : Hooks `setup` (démarrage DB) et `on_window_event` (arrêt DB).
    *   `desktop/src-tauri/src/mission_coordinator.rs` (SQUELETTE) : Commandes Tauri initiales `list_missions`.
*   **Critères de Done** :
    *   PostgreSQL s'éteint proprement quand l'utilisateur ferme l'application.
    *   L'UI peut requêter l'état du runtime (Running/Stopped).

---

## Risques Majeurs
1.  **Antivirus/Permissions** : Les binaires extraits dans `AppData` peuvent être bloqués.
2.  **Zombies** : En cas de crash violent de l'app, PostgreSQL peut rester actif et bloquer le port au reboot suivant.
3.  **Bundle Size** : Les binaires PG ajoutent ~60MB au package final.

## Checkpoints de Validation
1.  [ ] **Validation A** : Dossier `pgsql` présent dans `AppData` après le premier run.
2.  [ ] **Validation B** : Log "PostgreSQL is ready" dans la console Tauri.
3.  [ ] **Validation C** : Tables visibles via un client SQL externe (ex: DBeaver) sur le port local.
4.  [ ] **Validation D** : Pas de processus `postgres.exe` résiduel après fermeture de l'app.

## Ordre d'exécution recommandé
1.  Installation des dépendances SQLx (`Cargo.toml`).
2.  Implémentation du superviseur (`runtime_pgsql.rs`) sans les binaires (test avec un PG déjà installé).
3.  Intégration du bundling des binaires natifs.
4.  Écriture des premières migrations.
5.  Câblage des hooks Tauri (`main.rs`).

---

**Note** : Les binaires PostgreSQL seront téléchargés depuis le site officiel (distribution zip) et placés manuellement dans le dossier `resources` avant le premier build.
