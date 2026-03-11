# Research Status Index

Ce document permet de situer la validité des documents de recherche par rapport aux décisions officielles du build MVP.

## État des documents

| Document | Catégorie | Statut | Note |
| :--- | :--- | :--- | :--- |
| `research/model_mapping.md` | Modèles LLM | **Reference** | Toujours valide pour l'allocation des rôles. |
| `research/infra_topology.md` | Infrastructure | **Partially Outdated** | La topologie retenue est "Embedded Hybrid" avec PG natif (non Docker). |
| `research/open_source_services.md`| Services tiers | **Partially Outdated**| PostgreSQL est confirmé, mais SQLite est écarté pour l'état canonique. |
| `research/hardware_requirements.md`| Hardware | **Reference** | Valide pour le dimensionnement. |
| `research/mission_control_design.md`| UX/UI | **Reference** | Guide principal pour le build du cockpit. |
| `research/capability_registry_design.md`| Registry | **Reference** | Vision cible pour le capital opératoire. |

## Guide de lecture pour le build
- **Stockage Canonique** : Ne se référer qu'à `official_architecture_decisions.md` et `runtime_bootstrap_strategy.md`.
- **Gateway & Containers** : Se référer aux docs existants (Docker reste la norme pour ce périmètre).
- **UI/UX** : Se référer à `mission_control_design.md`.
