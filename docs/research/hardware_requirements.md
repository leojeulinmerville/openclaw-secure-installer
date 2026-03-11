# Requirements Hardware

Ce document définit les configurations matérielles recommandées pour exploiter OpenClaw selon différents scénarios d'usage, de l'assistant local léger au système autonome multi-agents.

## 1. Profil "Léger" (Assistant Local / Setup Mobile)
*   **Objectif** : Exécution de tâches simples, réponses rapides, faible consommation.
*   **Modèles** : Qwen-2.5-7B (Orchestrateur & Code), Llama-3-8B (Jugement/Texte).
*   **Matériel Cible** :
    *   **Mac** : M1/M2/M3 avec 16GB Unified Memory.
    *   **PC** : CPU 6+ cores, 16GB RAM, GPU avec 8GB VRAM (RTX 3060/4060).
    *   **Edge** : NVIDIA Jetson Orin Nano (8GB).
*   **Performance attendue** : 30-50 tokens/sec. 1 agent actif à la fois.

## 2. Profil "Desktop Avancé" (Développeur / Power User)
*   **Objectif** : Développement autonome, refactoring de code, gestion de missions de 10-20 minutes.
*   **Modèles** : DeepSeek-Coder-33B (Code), Qwen-2.5-14B/32B (Orchestration), Prometheus-2 (Audit).
*   **Matériel Cible** :
    *   **Mac** : M2/M3 Pro/Max avec 32GB ou 64GB Unified Memory.
    *   **PC** : CPU 8+ cores, 32GB RAM, GPU avec 12-16GB VRAM (RTX 3080/4070 Ti/4080).
*   **Performance attendue** : 15-25 tokens/sec. Possibilité de faire tourner un Orchestrateur et un Coder en parallèle sur le même GPU.

## 3. Profil "Homelab / Orchestrateur Gouverné" (Cible V2)
*   **Objectif** : Autonomie prolongée, trajectoires multiples (Branching), audit systématique par un juge puissant (Niveau 1/2).
*   **Modèles** : Llama-3-70B (Gouvernance), DeepSeek-Coder-V2 (Code), Multi-workers.
*   **Matériel Cible** :
    *   **Mac** : Mac Studio M2 Ultra avec 128GB Unified Memory.
    *   **PC** : Workstation avec 64GB+ RAM, GPU avec 24GB VRAM (RTX 3090/4090) ou multi-GPU (ex: 2x RTX 3060 12GB).
*   **Performance attendue** : 5-10 tokens/sec sur le 70B. Capacité à maintenir le Case File en mémoire VRAM.

## 4. Profil "Petit Serveur / Multi-VM"
*   **Objectif** : Système multi-agents permanent servant une petite équipe ou des automates.
*   **Architecture** : Topologie "Central Daemon" avec distribution des modèles sur plusieurs instances.
*   **Matériel Cible** :
    *   Serveur dédié (Hetzner/OVH ou local) avec NVIDIA A100/H100 ou 2x A6000.
    *   **CPU-Only** : Dual Xeon/Epyc avec 256GB RAM (utilisant llama.cpp en mode AVX/AMX - attention à la latence).

---

## Matrice de Dimensionnement (VRAM & RAM)

| Composant Système | VRAM Estimée (Q4) | RAM Système (Swap/Context) | Importance |
| :--- | :--- | :--- | :--- |
| **Orchestrateur (N3)** | 6 GB - 10 GB | 4 GB | Critique (Ligne de vie) |
| **Opérateur Code (N4)** | 8 GB - 20 GB | 8 GB | Critique (Production) |
| **Gouverneur/Juge (N1/2/5)** | 10 GB - 40 GB | 16 GB | Optionnel mais recommandé |
| **Daemon & State (SQLite)** | < 1 GB | 2 GB | Permanent |
| **Docker (Gateway/Plugins)** | < 1 GB | 4 GB | Permanent |

## Conseils d'optimisation (Souveraineté Locale)
1. **Quantisation Stricte** : Ne jamais descendre en dessous de Q4_K_M pour les modèles de Gouvernance (Niveau 1/2) sous peine de perdre l'alignement constitutionnel. Le Q2/Q3 est réservé aux tests rapides.
2. **Context Caching** : Utiliser des backends supportant le "KV Cache" persistant pour ne pas re-parser tout le `Case File` à chaque tour d'une mission longue.
3. **Offloading Intelligent** : Placer l'Orchestrateur (N3) et le Juge (N5) sur le GPU pour la vitesse, et laisser le modèle de Gouvernance (N1/2) sur le CPU/RAM si la VRAM manque (car il intervient moins souvent).
