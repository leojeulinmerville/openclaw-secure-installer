# Workstream A Execution Plan - Runtime Packaging Closure

## 1. Objective
L'objectif est de finaliser le packaging du runtime PostgreSQL pour l'application Tauri Windows. Il s'agit de garantir que le bundle binaire est présent, correctement référencé dans les ressources Tauri, et que le flux d'extraction vers `AppData` est validé de bout en bout pour un utilisateur final "zéro-config".

## 2. Format et Emplacement du Bundle PostgreSQL
Le bundle doit être une distribution binaire minimale de PostgreSQL pour Windows (x64).
- **Contenu attendu** : Dossiers `bin/`, `lib/`, `share/`. Les utilitaires critiques sont `postgres.exe`, `initdb.exe`, `pg_ctl.exe` et `pg_isready.exe`.
- **Fichier** : `postgresql-windows-x64.zip`.
- **Emplacement source** : `desktop/src-tauri/resources/`.
- **Risque** : ZIP trop volumineux (>100MB). Utiliser une version "binaries only" sans documentation ni symboles de debug.

## 3. Intégration avec les Ressources Tauri
Vérifier et verrouiller la configuration de bundling pour que Tauri inclue le ZIP dans l'installeur final (.msi/.exe).
- **Fichier à modifier** : `desktop/src-tauri/tauri.conf.json`.
- **Action** : S'assurer que le chemin `resources/postgresql-windows-x64.zip` est présent dans la section `bundle > resources`.
- **Done Criteria** : Le fichier ZIP est copié dans le répertoire `resources` lors du build (`tauri build`).

## 4. Comportement d'Extraction dans AppData
Le superviseur Rust doit gérer l'extraction de manière atomique pour éviter les corruptions si l'utilisateur ferme l'app pendant l'extraction.
- **Logique** : 
    1. Extraire dans un dossier temporaire `runtime/pgsql_tmp`.
    2. Renommer `pgsql_tmp` en `pgsql` une fois l'extraction terminée (opération atomique sur l'OS).
- **Fichiers à modifier** : `desktop/src-tauri/src/runtime_pgsql.rs`.
- **Done Criteria** : Le dossier `runtime/pgsql` ne contient que des binaires valides et complets.

## 5. Validation de la Présence des Binaires
Avant de tenter un `initdb`, le superviseur doit valider que les fichiers critiques sont bien présents sur le disque.
- **Action** : Ajouter un check de présence pour `bin/postgres.exe` et `bin/initdb.exe` après l'extraction.
- **Fichiers à modifier** : `desktop/src-tauri/src/runtime_pgsql.rs`.

## 6. Vérification du Premier Lancement
Simuler l'expérience d'un nouvel utilisateur sur une machine vierge.
- **Procédure** :
    1. Supprimer le dossier `AppData/Local/ai.openclaw.myopenclaw`.
    2. Lancer l'application.
    3. Observer l'émission des événements : `provisioning` -> `initializing` -> `ready`.
- **Risque** : Antivirus bloquant l'exécution de binaires depuis `AppData`.

## 7. Diagnostics en cas de ZIP manquant ou invalide
Si le ZIP est absent des ressources (erreur de build) ou corrompu, l'application doit le signaler explicitement via le modèle d'état `failed`.
- **Action** : Capturer l'erreur `Failed to resolve resource` et émettre l'état `failed` avec le code `provisioning_error`.
- **Fichiers à modifier** : `desktop/src-tauri/src/main.rs`.

## Tableau de Synthèse

| Composant | Fichiers | Artefact Attendu |
| :--- | :--- | :--- |
| **Bundle Source** | `resources/` | `postgresql-windows-x64.zip` (~60-80MB) |
| **Config Tauri** | `tauri.conf.json` | Entrée `resources` valide |
| **Superviseur** | `runtime_pgsql.rs` | Extraction atomique et validation binaires |
| **Main Loop** | `main.rs` | Gestion erreur `provisioning_error` |

---

## Recommended first implementation step
**Action** : Provisionner physiquement le bundle ZIP minimaliste dans `desktop/src-tauri/resources/`.

*   **Pourquoi** : C'est le bloqueur physique actuel. Sans ce fichier, aucune des logiques d'extraction (Workstream A) ou de démarrage (Workstream B) ne peut être testée en conditions réelles.
*   **Fichiers impliqués** : `desktop/src-tauri/resources/postgresql-windows-x64.zip`.
*   **Succès** : Le fichier ZIP est présent dans le répertoire et prêt à être consommé par le `PgRuntimeManager`.
