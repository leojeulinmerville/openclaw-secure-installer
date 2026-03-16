# Prompt Gemini pour mapping repo grounded OpenClaw

Tu dois travailler à partir du document `openclaw_master_orchestration_matrix_v1.md` comme source normative.

## But

Faire un mapping maximal entre cette doctrine stabilisée et la structure réelle Node/OpenClaw existante, afin de :

- réutiliser le maximum de l'existant
- éviter toute reconstruction parallèle inutile
- insérer un centre missionnel persistant sans casser le moteur actuel
- préparer un plan d'intégration incrémental et sobre

## Contraintes absolues

1. Ne pas rouvrir la doctrine du document source.
2. Ne pas proposer un second orchestrateur concurrent.
3. Ne pas déplacer la vérité canonique côté desktop UI.
4. Ne pas inventer de services qui dupliquent inutilement des composants Node existants.
5. Ne pas repartir d'une architecture greenfield.
6. Toujours préférer : reuse direct, puis adaptation légère, puis nouveau service minimal.

## Ce que tu dois produire

### A. Repo grounded mapping

Pour chaque grande brique du document source, identifier :

- les composants Node/OpenClaw existants potentiellement réutilisables
- les points d'insertion plausibles du Mission Coordinator
- les modules déjà proches des responsabilités visées
- les zones où il manque réellement une brique

### B. Classification stricte des écarts

Pour chaque besoin, classer en :

- reuse direct
- adaptation légère
- nouveau service minimal
- obsolescence ou contournement

### C. Focus prioritaire

Commencer par la première vague seulement :

- Mission
- Mission Charter
- Case File
- Contract
- Artifact
- Decision Record
- Validation Record
- Resume Snapshot
- Responsibility Ledger Entry
- MissionControlMissionView
- Mission Service
- Charter and Case File Service
- Contract Service
- Artifact and Validation Service
- Decision and Ledger Service
- Resume Service
- Mission Control Projection Service

### D. Ce qu'il faut rattacher au Node existant autant que possible

- moteur opérationnel existant
- activations et runs
- logs et traces déjà produits
- gateway et flux actuels
- primitives utiles de permissions, approvals, allowlists, pairing, execution
- systèmes d'extensions ou capacités déjà présents

### E. Livrable attendu

Un document markdown structuré avec :

1. Executive summary
2. Repository grounded current anchors
3. Mapping table doctrine -> repo
4. Reuse direct candidates
5. Adaptation légère candidates
6. Nouveau service minimal strictement nécessaire
7. Anti patterns à éviter
8. Intégration incrémentale recommandée par ordre
9. Risques de duplication ou dérive conceptuelle
10. Questions repo grounded restant ouvertes

## Style attendu

- repo grounded
- concret
- sans prose inutile
- sans refaire la doctrine
- sans greenfield bias
- orienté économie de build et sobriété d'intégration
