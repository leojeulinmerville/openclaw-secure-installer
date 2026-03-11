# Mapping des Modèles Open Source par Rôle

Ce document traduit l'architecture institutionnelle d'OpenClaw (les 5 Niveaux de responsabilité définis dans `product_system_v2.md`) en une stratégie de déploiement de modèles IA ("Model-as-a-Role"). 

L'objectif est d'optimiser l'allocation des ressources matérielles (VRAM, CPU) en évitant d'utiliser un modèle monolithique massif pour des tâches simples, et en réservant la puissance de calcul aux tâches de gouvernance et de raisonnement complexe.

## Hypothèses Matérielles (Profils de Quantisation)
Pour qu'OpenClaw reste auto-hébergeable, les modèles sont évalués selon leur format quantisé (GGUF Q4_K_M ou AWQ/GPTQ 4-bit) :
*   **Tier 1 (Sub-8B)** : ~4-6 GB VRAM. Latence très faible.
*   **Tier 2 (8B - 14B)** : ~6-12 GB VRAM. Latence faible. Exécutable sur GPU consumer (RTX 3060/4060) ou Mac M1/M2 16GB.
*   **Tier 3 (32B - 70B)** : ~24-40 GB VRAM. Latence moyenne. Nécessite Mac Studio (64GB+), RTX 3090/4090 x2, ou petit serveur dédié.

---

## Niveau 1 & 2 : Constitution, Policy et Gouvernance
Ces rôles ne produisent pas de code, ils jugent des situations ambiguës, évaluent des risques, et décident d'autoriser ou bloquer des transitions de trajectoire. Ils nécessitent des capacités maximales de raisonnement (reasoning), d'alignement sur des règles complexes (constitution), et une très faible probabilité de contournement (jailbreak intrinsèque).

*   **Rôles cibles** : `Risk Policy Manager`, `Mission Governor`, `Arbitration Agent`.
*   **Profil cognitif** : Raisonnement profond, jugement moral/sécuritaire, extraction de contexte complexe. Pas besoin de vitesse extrême.
*   **Familles de modèles recommandées** :
    *   **Llama-3-70B-Instruct** (Q4_K_M) : ~40GB VRAM. Le standard de facto pour le jugement complexe et l'alignement sur consigne.
    *   **Qwen-2.5-72B-Instruct** : Excellente compréhension multi-lingue et logique.
    *   **Mixtral 8x22B** : Architecture MoE, efficace si la RAM est abondante mais la VRAM limitée (offloading).
*   **Paramètres d'exécution** : Température très basse (0.0 - 0.1). Prompting constitutionnel fort.

## Niveau 3 : Orchestration Tactique (Mission Control)
C'est le "cerveau" opérationnel qui route, planifie et gère les branches. Il n'a pas besoin d'être un génie du code, mais il doit exceller dans l'appel d'outils (Tool Calling), la génération de JSON stricte, et le suivi de graphes de dépendances (DAG).

*   **Rôles cibles** : `Mission Planner`, `Task Router`, `Replanning Agent`.
*   **Profil cognitif** : Instruction-following parfait, Tool Calling natif, formatage structuré (JSON), rapidité d'exécution (pour ne pas ralentir la boucle).
*   **Familles de modèles recommandées** :
    *   **Qwen-2.5-14B / 32B** : Excellent en Tool Calling et respect strict de schémas. VRAM : ~10-20GB.
    *   **Llama-3-8B-Instruct** : Très rapide, bon en JSON si contraint par un grammaire (ex: via llama.cpp grammar). VRAM : ~6GB.
    *   **Mistral-Nemo-12B** : Fort compromis entre taille (VRAM ~8GB) et fenêtre de contexte (128k) utile pour garder le Case File en mémoire.
*   **Paramètres d'exécution** : Mode strict JSON / Function Calling obligatoire.

## Niveau 4 : Opérateurs Spécialisés (Execution Plane)
Ce sont les "workers" qui produisent l'effort réel. Leurs besoins varient selon la spécialité (code, recherche, documentation).

### 4.1. Implémentation & Debug (Coders)
*   **Rôles cibles** : `Implementation Agent`, `Debug Analyst`, `Solution Architect`.
*   **Profil cognitif** : Spécialistes du code, compréhension de répertoires entiers, génération de diffs/patchs.
*   **Familles de modèles recommandées** :
    *   **DeepSeek-Coder-V2-Lite (16B)** ou **DeepSeek-Coder-33B** : Les meilleurs modèles open-weights spécialisés en code et refactoring.
    *   **Qwen-2.5-Coder (7B / 32B)** : Très performants sur les langages modernes (TS, Rust) avec d'excellentes capacités d'édition de fichiers.
    *   **Phind-CodeLlama-34B** : Pour des réponses d'architecture et de résolution de bugs profonds.

### 4.2. Recherche, Synthèse & Documentation
*   **Rôles cibles** : `Research Agent`, `Documentation Agent`.
*   **Profil cognitif** : Grande fenêtre de contexte pour ingérer de la doc, capacité RAG, extraction d'information.
*   **Familles de modèles recommandées** :
    *   **Command-R / Command-R+ (Cohere open-weights)** : Spécialement entraînés pour le RAG et l'utilisation d'outils de recherche web avec citations.
    *   **Llama-3-8B-Instruct (1M context)** : Pour résumer de longs documents à très grande vitesse.

## Niveau 5 : Audit, Validation & Apprentissage
Ces rôles relisent les trajectoires, évaluent les preuves (Evidence Bundles) et produisent des scores ou des résumés de continuité.

*   **Rôles cibles** : `Run Auditor`, `Performance Scorer`, `Drift Monitor`.
*   **Profil cognitif** : LLM-as-a-Judge. Capacité à lire un contrat, lire un artefact, et produire une critique objective (Critique generation).
*   **Familles de modèles recommandées** :
    *   **Prometheus-2 (7B ou 8B)** : Modèles fine-tunés spécifiquement pour l'évaluation (LLM-as-a-Judge) à partir de rubriques définies. (Très économe : ~6GB VRAM).
    *   **Llama-3-70B** : En mode batch/asynchrone post-mission pour extraire de l'Apprentissage (Capital Opératoire) depuis de larges historiques.

---

## Synthèse d'Allocation (Matrice de Déploiement)

| Niveau Institutionnel | Profil Exigé | VRAM cible (Q4) | Recommandation Principale | Alternative Légère (Edge) |
| :--- | :--- | :--- | :--- | :--- |
| **N1/N2: Gouvernance** | Jugement, Alignement | 24GB - 40GB | Llama-3-70B / Qwen-72B | Llama-3-8B (si très contraint) |
| **N3: Orchestration** | Tool Calling, JSON, Rapide | 8GB - 16GB | Qwen-2.5-14B / 32B | Qwen-2.5-7B |
| **N4: Opérateurs (Code)** | FIM (Fill-in-middle), Syntaxe | 16GB - 24GB | DeepSeek-Coder-V2 / 33B | Qwen-2.5-Coder-7B |
| **N4: Opérateurs (Text)** | RAG, Contexte long | 8GB - 16GB | Command-R / Mistral-Nemo | Llama-3-8B |
| **N5: Audit & Juge** | LLM-as-a-Judge, Critique | 6GB - 16GB | Prometheus-2-8B | Qwen-2.5-7B-Instruct |

## Conséquences pour le Système OpenClaw
1. **Multi-Provider Local** : OpenClaw doit pouvoir gérer de multiples instances d'Ollama ou llama.cpp simultanément sur différents ports, pour interroger le modèle approprié selon le contrat en cours.
2. **Grammars & Formats** : Le niveau 3 exige l'intégration native de générateurs sous contrainte (ex: JSON Schema enforcement) pour éviter des erreurs de parsing coûteuses en temps.
3. **Offloading Asynchrone** : Le niveau 5 (Apprentissage) peut être exécuté par un grand modèle déchargé principalement sur CPU/RAM pendant que le système n'est pas sollicité par l'utilisateur.
