# Runtime Bootstrap Strategy - PostgreSQL Windows

Ce document détaille la stratégie de gestion automatique du runtime PostgreSQL local pour l'installateur Windows d'OpenClaw MVP.

## 1. Objectifs
- Faire fonctionner un serveur PostgreSQL standard localement sans intervention humaine.
- Garantir la persistance des données missionnelles entre les sessions.
- Rester compatible avec un packaging `.exe` Windows unique.

## 2. Contraintes Produit
- **Zero-Config** : Pas d'UI de configuration de base de données pour l'utilisateur final.
- **Portabilité** : Le runtime doit pouvoir être relocalisé si nécessaire dans le dossier `AppData`.
- **Isolation** : Ne pas interférer avec d'autres instances PostgreSQL déjà présentes sur la machine.

## 3. Options de Bootstrap (Windows)

| Option | Description | Avantage | Inconvénient |
| :--- | :--- | :--- | :--- |
| **Full Installer** | Lancer l'installateur MSI d'EnterpriseDB en mode silencieux. | Standard industriel | Très lent, nécessite des droits admin élevés, pollution du système. |
| **Binaries ZIP (Retenu)** | Inclure les binaires PostgreSQL (zip) dans le package Tauri et les extraire dans `AppData`. | **Léger, local, droits limités, "One-click".** | Nécessite de gérer `initdb` soi-même. |
| **Docker DB** | Lancer PG via Docker. | Isolation parfaite | **Exclu** (Docker n'est pas une dépendance obligatoire du socle). |

## 4. Lifecycle du Runtime PostgreSQL

### Installation / Premier Démarrage
1.  **Extraction** : Le backend Tauri vérifie si les binaires PG sont présents dans `AppData/OpenClaw/runtime/pgsql`.
2.  **Initialisation (initdb)** : Si le dossier `data/` est absent, l'application lance `initdb.exe -D ./data -U openclaw --no-auth-local`.
3.  **Bootstrap DB** : Une fois le serveur démarré, création de la base `openclaw_canonical`.

### Démarrage Nominal
1.  **Port Scan** : Vérifier si le port par défaut (5432) est libre, sinon en choisir un aléatoirement.
2.  **pg_ctl start** : Lancement du processus `postgres.exe` via le backend Rust.
3.  **Health Check** : Tentative de connexion via SQLx. Si OK, chargement des migrations.

### Crash & Recovery
1.  **Auto-Restart** : Si le processus `postgres.exe` tombe, le backend tente de le redémarrer N fois.
2.  **Stale Lock** : Gestion du fichier `postmaster.pid` si le système a crashé brutalement.

### Désinstallation
1.  L'installateur propose de supprimer ou de conserver le dossier `AppData/OpenClaw/data`.

## 5. Rôle des composants

- **L'Installateur (.exe)** : Provisionne les binaires zip compressés.
- **Le Backend Rust (Tauri)** : Agit comme le superviseur du service. Il est responsable du `start/stop` et de l'orchestration du `initdb`.

## 6. Points de Vigilance
- **Permissions** : S'assurer que le dossier `data` est accessible en lecture/écriture par l'utilisateur courant.
- **Antivirus** : Certains AV peuvent bloquer l'exécution de binaires extraits dans `AppData`.
- **Espace Disque** : Monitorer la taille de la base pour éviter de saturer le disque utilisateur.

## 7. Checklist de Validation Technique
- [ ] L'application démarre et crée le dossier `data` sans erreur.
- [ ] Une seconde instance de l'application détecte que PG tourne déjà ou utilise un autre port.
- [ ] Les migrations SQL s'exécutent au premier boot.
- [ ] Le processus `postgres.exe` s'arrête proprement quand on ferme l'application.

## 8. Décisions encore ouvertes
- **Version exacte de PG** : Recommandation v16.x pour la stabilité.
- **Authentification** : Utilisation de `peer` (Windows local) ou d'un token généré aléatoirement au premier boot et stocké dans le trousseau de secrets.
