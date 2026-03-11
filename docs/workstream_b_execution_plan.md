# Workstream B Execution Plan - Reliability & Sequencing

## 1. Objective
L'objectif de ce plan est de fiabiliser la séquence de démarrage de PostgreSQL et l'initialisation du pool SQLx. Il s'agit d'éliminer les conditions de course (race conditions) et de garantir que le socle de données est opérationnel avant que le reste de l'application ne soit sollicité.

## 2. Startup Order (Tauri Lifecycle)
La séquence doit être strictement linéaire au sein du hook `setup` de Tauri :
1.  **Extraction/Check Binaires** (Workstream A).
2.  **Dynamic Port Selection** : Trouver un port libre (priorité à 5432).
3.  **Start Server** : Lancer `postgres.exe` sur le port choisi.
4.  **Readiness Wait** : Attendre que PostgreSQL réponde sur le port TCP.
5.  **SQLx Initialization** : Créer le pool de connexions.
6.  **Migrations** : Appliquer le schéma (Workstream C).
7.  **State Management** : Enregistrer le pool dans l'état Tauri.

*   **Fichiers à modifier** : `desktop/src-tauri/src/main.rs`.

## 3. PostgreSQL Readiness Wait Strategy
Au lieu de simplement "spawn" le processus, le `PgRuntimeManager` doit implémenter une boucle d'attente active (polling).
- **Méthode** : Tentative de connexion TCP sur `127.0.0.1:{port}` toutes les 200ms pendant maximum 10 secondes.
- **Alternative** : Utiliser `pg_isready.exe` (plus lourd car invoque un processus externe). La méthode TCP est recommandée pour sa légèreté.

*   **Fichiers à modifier** : `desktop/src-tauri/src/runtime_pgsql.rs`.

## 4. Dynamic Port Strategy
Le système doit être capable de gérer un port 5432 déjà utilisé par une instance PostgreSQL globale.
- **Logique** : 
    1. Tester 5432.
    2. Si occupé, tester une plage (ex: 5433-5440).
    3. Lever une erreur bloquante si aucun port n'est disponible.
- Le port sélectionné doit être passé à la chaîne de connexion SQLx.

*   **Fichiers à modifier** : `desktop/src-tauri/src/runtime_pgsql.rs`, `desktop/src-tauri/src/main.rs`.

## 5. Health Check Strategy
Une fois SQLx connecté, un "Deep Health Check" doit être effectué :
- Exécution de `SELECT 1`.
- Vérification de la présence de la table `missions`.
- Si échec, le système doit tenter un redémarrage du runtime ou alerter l'utilisateur.

*   **Fichiers à modifier** : `desktop/src-tauri/src/db.rs`.

## 6. Failure Handling & User Diagnostics
Si une étape de la séquence échoue :
- Log clair dans la console (Stderr).
- Émission d'un événement Tauri `db-init-failed` vers le frontend.
- Empêcher le démarrage des agents ou des fonctions de coordination.

## 7. Shutdown Behavior
Le serveur PostgreSQL doit être arrêté proprement dans le hook `on_window_event`.
- **Cas critique** : Gérer le crash de l'app. Au redémarrage, le superviseur doit détecter si un fichier `postmaster.pid` existe et vérifier si le processus associé est encore vivant avant de tenter un `initdb` ou un `start`.

*   **Fichiers à modifier** : `desktop/src-tauri/src/runtime_pgsql.rs`.

## 8. Validation Procedure

### First Launch (Dossier data absent)
1. Supprimer `AppData/Local/.../data`.
2. Lancer l'app.
3. Vérifier que les logs montrent : Selection port -> Start -> **Waiting for ready** -> Connected -> Migrations.

### Second Launch (Dossier data présent)
1. Fermer l'app proprement.
2. Relancer.
3. Vérifier que PostgreSQL démarre sans `initdb` et que SQLx se connecte instantanément.

### Conflict Case
1. Lancer manuellement un service sur le port 5432 (ex: `nc -l 5432`).
2. Lancer l'app.
3. Vérifier que l'app choisit le port 5433 et démarre correctement.

---

## Recommended first code change
**Action** : Implémenter la méthode `wait_for_ready` dans `PgRuntimeManager` utilisant un probe TCP.

*   **Pourquoi** : C'est le verrou technique qui bloque la fiabilisation de tout le reste du boot. Tant que nous n'avons pas cette attente, SQLx échouera de manière aléatoire au premier boot.
*   **Fichiers concernés** : `desktop/src-tauri/src/runtime_pgsql.rs`.
*   **Succès** : La fonction retourne `Ok(())` dès que le port est ouvert, ou `Err` après un timeout de 10s.
