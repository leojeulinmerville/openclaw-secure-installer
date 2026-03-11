# Decision Memo v1 - Canonical Data Store & Runtime Strategy

Ce document acte la décision officielle concernant le socle de données d'OpenClaw MVP et sa stratégie de distribution utilisateur final.

## 1. Décision : PostgreSQL comme Source de Vérité Canonique

**Observation**
Le système nécessite une gestion transactionnelle robuste, des relations complexes entre missions, contrats et preuves, ainsi qu'une scalabilité alignée sur la vision "Système Autonome Gouverné" (V2).

**Décision**
**PostgreSQL Standard Local** est retenu comme source de vérité canonique dès le MVP. 
- SQLite est abandonné pour le stockage de l'état missionnel.
- Le déploiement s'appuie sur une instance PostgreSQL native Windows (non-Docker) gérée par l'application.

**Impact**
- Coût de développement initial plus élevé (gestion du cycle de vie du runtime).
- Alignement total avec la cible produit long terme.
- Robustesse et performance accrues pour les requêtes complexes (Audit, Case File).

---

## 2. Expérience Utilisateur : "One-Click & Invisible"

**Observation**
L'utilisateur final (non-technique) ne doit pas avoir à installer ou configurer une base de données manuellement.

**Décision**
Le package `.exe` (installateur Windows) doit être auto-suffisant.
- **Bootstrap Automatique** : L'application ou l'installateur provisionne les binaires PostgreSQL.
- **Configuration Zéro** : Le cluster (initdb), la base applicative et les accès sont créés de manière transparente au premier démarrage.
- **Gestion du Runtime** : L'application gère le démarrage (`pg_ctl start`) et l'arrêt du service localement.

**Impact**
- L'utilisateur perçoit une application desktop classique sans voir le moteur SQL sous-jacent.
- Sécurité renforcée par une configuration de service locale non-exposée au réseau.

---

## 3. Architecture Technique MVP

| Composant | Technologie Retenue | Rôle |
| :--- | :--- | :--- |
| **Store Canonique** | PostgreSQL 16+ (Standard Local) | Missions, Contrats, Artifacts, Evidence, Decision Records. |
| **Runtime Manager** | Rust (Tauri Backend) | Pilotage du processus `postgres.exe` et `pg_ctl`. |
| **Accès Données** | SQLx ou Diesel (Rust) | Gestion des migrations et requêtes typées. |
| **Isolation** | Service Local Windows | Sécurisation du port par défaut sur localhost uniquement. |

---

## 4. Risques et Atténuations

| Risque | Impact | Atténuation |
| :--- | :--- | :--- |
| **Conflit de port** | Échec du démarrage | Recherche dynamique d'un port libre ou port standard configurable. |
| **Installation corrompue** | Perte de données | Stratégie de backup automatique et vérification d'intégrité au boot. |
| **Taille du package** | Augmentation de l'EXE | Utilisation d'une distribution minimaliste de binaires PostgreSQL (zip). |

---

## 5. Synthèse des Intentions

**Ce que nous faisons** : Construire une architecture "Enterprise-grade" simplifiée pour le desktop, garantissant que les données d'autonomie et de gouvernance sont stockées sur un moteur SQL puissant et évolutif.

**Ce que nous ne faisons pas** : Demander à l'utilisateur d'installer Docker pour le socle missionnel, ou utiliser une DB éphémère qui limiterait la profondeur du Case File et de l'Audit.
