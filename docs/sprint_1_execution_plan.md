# Sprint 1 Execution Plan

## 1. Sprint 1 objective

Faire exister la mission comme premier objet métier réellement opérable au dessus du socle Sprint 0 déjà validé, sans reconstruire le runtime ni le noyau de schéma déjà livré.

Sprint 1 doit livrer quatre choses, et uniquement ces quatre choses :

- un audit réel du schéma canonique déjà présent
- une couche repository et service propre au dessus de SQLx
- un Mission Coordinator minimal embarqué côté Rust/Tauri
- une première intégration desktop mission-centric lue depuis l’état canonique réel

La cible de Sprint 1 n’est pas Mission Control complet. La cible est une première chaîne cohérente : créer une mission persistante, lui attacher les objets minimaux utiles, maintenir une projection stable, la relire dans le desktop, puis supporter pause et reprise minimales.

## 2. Confirmed in-scope

- Audit du schéma déjà livré dans `desktop/src-tauri/migrations/20260311000000_init_core.sql` et des migrations ultérieures déjà présentes dans la branche réelle
- Vérification du noyau existant autour de : `missions`, `mission_charters`, `case_files`, `mission_state_projections`, `contracts`, `artifacts`, `decision_records`, `validation_records`, `resume_snapshots`
- Création d’une couche repository Rust au dessus de `db.rs` et `sqlx`
- Création d’une couche service minimale pour les cas d’usage Sprint 1
- Implémentation du Mission Coordinator embarqué côté Rust/Tauri, en s’appuyant sur le squelette existant de `desktop/src-tauri/src/mission_coordinator.rs`
- Exposition de commandes Tauri mission-centric minimales et de DTOs stables pour le frontend
- Intégration desktop minimale avec liste de missions persistantes et vue détail sobre, strictement alimentées par le backend Sprint 1
- Support des actions minimales suivantes si produites réellement par le backend : create mission, list missions, get mission detail, admit initial contract, pause mission, resume mission, refresh state

## 3. Explicit out-of-scope

- Toute réouverture de Sprint 0
- Toute reconstruction du runtime PostgreSQL local, du bootstrap, du packaging ou des migrations déjà validées
- Toute création de nouvelles tables spéculatives
- Toute refonte du moteur CLI existant ou de la Gateway
- Toute tentative de V2 complète, y compris branching complet, evidence explorer riche, capability registry avancé, policy plane, workflow engine, daemon externe dédié, orchestration distribuée ou streaming riche des runs
- Toute UI prétendant afficher des signaux de gouvernance, de coût, de sécurité ou de supervision que le backend Sprint 1 ne produit pas réellement
- Toute dépendance du state principal de Mission Control à `events.jsonl`, aux logs bruts ou à des états React isolés
- Toute réconciliation complète des runs CLI vers le modèle canonique. Le bridge profond run-to-canonical reste hors de Sprint 1

## 4. Repository-grounded current starting point

Le point de départ réel du repo est le suivant.

- Le desktop Tauri/React est la surface de contrôle principale dans `desktop/`
- Le backend Rust expose déjà des commandes et orchestre plusieurs sous-systèmes depuis `desktop/src-tauri/src/main.rs`
- L’exécution actuelle reste majoritairement run-centric via `desktop/src-tauri/src/runs.rs`, avec un point de vérité encore largement adossé à `runs/{run_id}/meta.json` et `runs/{run_id}/events.jsonl`
- La persistance d’état desktop continue d’utiliser `state.json` pour des sujets d’installation, settings et état de surface via `desktop/src-tauri/src/state_manager.rs`
- La couche SQLx et le runtime PostgreSQL local ont été mis en place pendant Sprint 0 avec `desktop/src-tauri/src/db.rs`, les migrations SQL dans `desktop/src-tauri/migrations/`, et un squelette `desktop/src-tauri/src/mission_coordinator.rs`
- Le frontend possède déjà des pages opérationnelles run-centric et infrastructure-centric dans `desktop/src/pages/`, avec des zones encore mockées ou statiques sur `Overview.tsx` et `Policies.tsx`

Conséquence directe pour Sprint 1 :

- il faut insérer une nouvelle couche d’autorité missionnelle dans le backend Rust, sans casser l’existant run-centric
- il faut faire lire au frontend une projection missionnelle stable venant du backend SQL, et non de la UI elle-même
- il faut rester sobre sur la surface UI tant que le backend ne produit pas plus

## 5. Sub-block A: schema audit

### objectif

Auditer le schéma canonique réellement déjà livré avant toute modification, puis décider s’il existe ou non un delta strictement nécessaire au flux Sprint 1. Ce sous-bloc n’autorise ni reconstruction du noyau, ni ajout spéculatif.

### Schema audit matrix

| table existante | usage prévu dans Sprint 1 | suffisant / insuffisant | delta éventuel strictement nécessaire | justification |
| :--- | :--- | :--- | :--- | :--- |
| `missions` | Racine persistante pour création, listing, détail, pause et reprise minimale | Présumé suffisant si la table contient au moins l’identité, le statut, le mode, la phase, l’état de gouvernance, l’état de santé, la readiness de reprise et les timestamps | Aucun par défaut. Seul delta admissible après audit : ajout d’un champ nullable strictement requis par pause/reprise ou par la projection minimale si impossible à dériver proprement | Sprint 1 ne doit pas déplacer l’autorité hors de `missions`, mais ne doit pas non plus enrichir la table sans besoin prouvé |
| `mission_charters` | Stocker le mandat initial lié à la mission au moment de la création et le relire dans le détail mission | Présumé suffisant si lien `mission_id` et champs d’intention / goal / contraintes existent déjà | Aucun par défaut | Le flux Sprint 1 a besoin d’un charter lié à la mission, pas d’un versioning riche ni d’un modèle multi-charter avancé |
| `case_files` | Porter le résumé vivant, les risques ouverts, obligations et continuité utile à la reprise | Présumé suffisant si la table permet de stocker un résumé courant et au moins un minimum de continuité de reprise | Aucun par défaut. Delta admissible uniquement si un champ de résumé ou de next action manque et bloque réellement la reprise minimale | Le case file doit servir à la continuité, mais Sprint 1 n’exige pas encore une structure riche ni des sous-objets avancés |
| `mission_state_projections` | Source rapide pour liste missions et détail mission minimal | Présumé suffisant si la projection contient mission_id, phase, status, health, governance, focus, blocker/risk si présents, resume readiness et updated_at | Aucun par défaut. Delta admissible uniquement si un signal explicitement affiché en Sprint 1 ne peut pas être produit sans bricolage ad hoc | La projection est le contrat principal backend vers Mission Control. Tout champ UI promis doit être produit ici ou dérivé service side de façon stable |
| `contracts` | Support de l’admission du premier contrat et du preview des contrats actifs / bloqués dans le détail mission | Présumé suffisant si mission_id, type, titre, status, health, governance, assigned_role et updated_at existent déjà | Aucun par défaut | Sprint 1 a besoin d’un premier contrat gouvernable, pas d’une taxonomie riche ni d’un branching contractuel |
| `artifacts` | Afficher éventuellement un preview d’artefacts récents si le backend en produit réellement | Présumé suffisant pour Sprint 1 si mission_id, origin_contract_id éventuel, type, nom, status, promotion_state et updated_at existent déjà | Aucun par défaut | Les artefacts ne doivent apparaître dans l’UI Sprint 1 que si des données réelles existent. Aucun enrichissement ne doit être ajouté par anticipation |
| `decision_records` | Enregistrer et relire les décisions significatives les plus récentes | Présumé suffisant si mission_id, type, résumé, outcome, responsabilité et timestamp existent déjà | Aucun par défaut | Le feed décisionnel Sprint 1 doit rester court et réel. Pas de journalisation de gouvernance étendue |
| `validation_records` | Enregistrer et relire les validations significatives les plus récentes | Présumé suffisant si mission_id, scope, outcome, résumé, responsabilité et timestamp existent déjà | Aucun par défaut | Même logique que pour les décisions. Sprint 1 n’a pas besoin d’un modèle d’évaluation avancé |
| `resume_snapshots` | Permettre pause / reprise minimale avec dernier état condensé | Présumé suffisant si mission_id, résumé de snapshot, mode de reprise recommandé ou équivalent, next action éventuelle et timestamp existent déjà | Aucun par défaut. Delta admissible uniquement si l’absence d’un champ rend impossible un resume flow minimal gouvernable | Le resume snapshot est la seule table où un petit delta ciblé peut être admissible, mais uniquement si la reprise minimale ne peut pas être implémentée autrement |

### fichiers à créer

- Aucun fichier de code par défaut
- `docs/schema_audit_sprint_1.md` si et seulement si tu veux garder la trace de l’audit dans le repo avant implémentation

### fichiers à modifier

- `desktop/src-tauri/migrations/20260311000000_init_core.sql`
- Toute migration supplémentaire déjà présente dans `desktop/src-tauri/migrations/` sur la branche réelle
- `desktop/src-tauri/src/db.rs` uniquement pour vérifier le chargement et l’ordre d’application des migrations, sans changement fonctionnel si non nécessaire

### dépendances

- Schéma Sprint 0 réellement présent dans la branche
- Possibilité de lancer l’application et de vérifier la base locale créée dans AppData
- Accès à un client SQL ou à des commandes de vérification simples pour confirmer le schéma effectif

### risques

- Prendre une spec comme vérité absolue sans vérifier la migration réellement livrée
- Confondre un manque de confort UI avec un manque de schéma réellement bloquant
- Ajouter un champ “utile plus tard” sans besoin démontré pour le flux Sprint 1
- Rejouer mentalement Sprint 0 et retomber dans une reconstruction du noyau

### critères de done

- Les 9 tables existantes ont été auditées une par une dans la migration réelle
- Chaque table possède une conclusion explicite : suffisant, ou insuffisant avec delta strictement nécessaire
- Aucun delta n’est retenu sans justification directe depuis un cas d’usage Sprint 1 réel
- Si aucun delta n’est nécessaire, la conclusion officielle du sous-bloc est “no schema change for Sprint 1”

### validation manuelle

- Démarrer l’application packagée ou la branche dev actuelle
- Vérifier que PostgreSQL local et les migrations montent normalement
- Inspecter le schéma effectif dans la base locale
- Comparer table par table le schéma réel avec le flux Sprint 1 visé
- Produire la décision finale “no delta” ou “delta minimal ciblé” avant toute écriture de code applicatif

### ce qui est explicitement hors périmètre

- Réécriture des migrations existantes pour des raisons de propreté théorique
- Ajout de tables nouvelles
- Ajout de colonnes “pour plus tard”
- Enrichissement du schéma pour la V2

## 6. Sub-block B: repository layer

### objectif

Introduire une couche repository minimale et claire au dessus de SQLx, afin que les accès au state missionnel ne soient pas dispersés dans les commandes Tauri ou dans le coordinateur lui-même.

### fichiers à créer

- `desktop/src-tauri/src/repositories/mod.rs`
- `desktop/src-tauri/src/repositories/missions_repository.rs`
- `desktop/src-tauri/src/repositories/mission_charters_repository.rs`
- `desktop/src-tauri/src/repositories/case_files_repository.rs`
- `desktop/src-tauri/src/repositories/mission_state_projections_repository.rs`
- `desktop/src-tauri/src/repositories/contracts_repository.rs`
- `desktop/src-tauri/src/repositories/artifacts_repository.rs`
- `desktop/src-tauri/src/repositories/decision_records_repository.rs`
- `desktop/src-tauri/src/repositories/validation_records_repository.rs`
- `desktop/src-tauri/src/repositories/resume_snapshots_repository.rs`

### fichiers à modifier

- `desktop/src-tauri/src/main.rs`
- `desktop/src-tauri/src/db.rs`
- `desktop/src-tauri/src/mission_coordinator.rs` pour retirer toute logique d’accès direct à la DB qui doit être absorbée par les repositories

### dépendances

- Sous-bloc A terminé
- Pool SQLx stable déjà disponible via `db.rs`
- Convention de structs Rust alignée sur le schéma réellement audité

### risques

- Introduire une couche repository trop abstraite et trop large pour Sprint 1
- Mélanger lecture de projection UI et écriture métier dans les mêmes repositories sans séparation lisible
- Laisser une partie des accès SQL dans `mission_coordinator.rs` et une autre dans les repositories, ce qui recrée la dispersion

### critères de done

- Chaque table en scope Sprint 1 possède un repository dédié ou clairement regroupé sans ambiguïté
- Les opérations minimales requises existent : create mission aggregate pieces, load mission aggregate, list missions, create/read initial contract, read recent records, read latest resume snapshot, upsert projection
- Le coordinateur n’écrit plus directement du SQL métier hors cas techniques très justifiés
- Les erreurs DB remontent avec une structure exploitable et non comme simples chaînes opaques partout

### validation manuelle

- Créer une mission test via appel backend contrôlé
- Vérifier que l’agrégat se relit proprement via repositories sans requêtes dispersées
- Vérifier que la lecture de projection et la lecture du détail mission utilisent bien la nouvelle couche repository

### ce qui est explicitement hors périmètre

- Repository générique abstrait multi-domaines
- ORM additionnel
- Optimisations de performance prématurées
- Repositories pour des domaines non utilisés par Sprint 1

## 7. Sub-block C: service layer

### objectif

Formaliser les cas d’usage métier Sprint 1 au dessus des repositories, pour isoler clairement les opérations applicatives du desktop et préparer un Mission Coordinator propre.

### fichiers à créer

- `desktop/src-tauri/src/services/mod.rs`
- `desktop/src-tauri/src/services/mission_service.rs`
- `desktop/src-tauri/src/services/contract_service.rs`
- `desktop/src-tauri/src/services/projection_service.rs`
- `desktop/src-tauri/src/services/resume_service.rs`
- `desktop/src-tauri/src/services/records_service.rs`

### fichiers à modifier

- `desktop/src-tauri/src/mission_coordinator.rs`
- `desktop/src-tauri/src/main.rs`

### dépendances

- Sous-bloc B terminé
- Contrat clair sur les opérations Sprint 1 à supporter
- Décision finale du sous-bloc A sur d’éventuels deltas de schéma, s’il y en a vraiment

### risques

- Déplacer trop de logique métier directement dans le coordinateur au lieu des services
- Construire des services trop couplés au frontend au lieu de rester orientés cas d’usage métier
- Tenter d’anticiper les besoins de Sprint 2 ou de la V2 dans les services Sprint 1

### critères de done

- Les cas d’usage suivants existent côté service, de façon explicite : create mission, build initial mission aggregate, admit initial contract, refresh projection, get mission detail, list missions, pause mission, create resume snapshot minimal, resume mission minimal
- Les services ne dépendent pas des composants UI React
- Les services peuvent être appelés par le coordinateur comme API interne claire

### validation manuelle

- Enchaîner les cas d’usage Sprint 1 depuis le backend sans UI
- Vérifier qu’une mission créée possède bien les objets attendus en base
- Vérifier que pause puis reprise minimale produisent un état cohérent et lisible

### ce qui est explicitement hors périmètre

- Scheduler avancé
- Policy engine
- Recovery riche
- Branching model
- Service layer multi-process ou distribué

## 8. Sub-block D: Mission Coordinator embedded in Rust/Tauri

### objectif

Transformer `desktop/src-tauri/src/mission_coordinator.rs` en véritable noyau de coordination persistante Sprint 1, connecté aux services et à la base canonique, tout en restant minimal et local au produit actuel.

### fichiers à créer

- Aucun fichier obligatoire si `desktop/src-tauri/src/mission_coordinator.rs` reste l’entrée centrale
- Optionnel uniquement si la taille du module l’impose réellement : `desktop/src-tauri/src/mission_coordinator_types.rs`

### fichiers à modifier

- `desktop/src-tauri/src/mission_coordinator.rs`
- `desktop/src-tauri/src/main.rs`
- `desktop/src-tauri/src/db.rs` uniquement si nécessaire pour injecter proprement les dépendances coordinator/services

### dépendances

- Sous-blocs B et C terminés
- Décision de schéma figée
- Contrat minimal des opérations coordinateur figé

### risques

- Faire du Mission Coordinator un simple wrapper mince sans autorité réelle
- Faire du Mission Coordinator un orchestrateur trop ambitieux pour Sprint 1
- Laisser la vérité métier principale dans `runs.rs` ou côté UI au lieu de la centraliser dans le coordinateur
- Recréer une dépendance aux logs bruts pour calculer l’état principal affiché

### critères de done

- Le coordinator supporte explicitement au minimum : create mission, list missions, get mission detail, admit initial contract, refresh projection, pause mission, resume mission
- Le coordinator crée ou met à jour les objets canoniques requis au lieu de déléguer la vérité principale aux logs ou à la UI
- Le coordinator devient la seule porte d’entrée backend autorisée pour les cas d’usage mission-centric Sprint 1
- Aucun sujet V2 n’est tiré dans le coordinator au delà de ce noyau

### validation manuelle

- Créer une mission depuis un appel backend puis fermer / relancer l’application
- Vérifier que la mission est relisible et que sa projection existe toujours
- Vérifier que pause puis reprise passent bien par le coordinator et aboutissent à un état cohérent en base

### ce qui est explicitement hors périmètre

- Daemon externe
- Worker pool
- Bus d’événements complet
- Gouvernance riche
- Bridge profond avec les runs CLI
- Streaming temps réel sophistiqué

## 9. Sub-block E: Tauri commands and DTOs

### objectif

Exposer un contrat backend stable, minimal et strictement réel au frontend desktop, afin que l’UI lise et pilote la mission via des DTOs propres au lieu d’assembler elle-même des états dispersés.

### fichiers à créer

- `desktop/src-tauri/src/mission_dto.rs`
- `desktop/src-tauri/src/mission_commands.rs`

### fichiers à modifier

- `desktop/src-tauri/src/main.rs`
- `desktop/src-tauri/src/mission_coordinator.rs`

### dépendances

- Sous-bloc D terminé
- Projection backend réellement disponible
- Cas d’usage Tauri minimaux figés

### risques

- Exposer des champs UI non produits par le backend
- Retourner directement des entités de base de données au frontend au lieu de DTOs stables
- Faire de `mission_commands.rs` une couche de logique métier alors qu’elle doit rester une surface d’exposition fine

### critères de done

- Les commandes Tauri suivantes existent et sont testables manuellement : `create_mission`, `list_missions`, `get_mission_detail`, `admit_initial_contract`, `pause_mission`, `resume_mission`, `refresh_mission_state`
- Un DTO liste mission existe pour la vue liste
- Un DTO détail mission existe pour la vue détail, contenant uniquement des champs réellement produits par le coordinator et les services Sprint 1
- Le DTO détail mission n’expose pas de champs V2 simulés ou calculés ad hoc depuis des logs bruts

### validation manuelle

- Appeler chaque commande Tauri en devtools ou via le frontend minimal
- Vérifier que les réponses sont stables, typées et cohérentes après redémarrage de l’application
- Vérifier qu’aucun champ vide “promis” n’est affiché comme si le système savait déjà le produire

### ce qui est explicitement hors périmètre

- API publique réseau
- WebSocket temps réel
- DTOs riches pour branching, evidence explorer, policy ou capability registry
- Contrats frontend contenant des données mockées par défaut

## 10. Sub-block F: desktop UI minimal integration

### objectif

Introduire une première intégration mission-centric réelle dans le desktop, sobre et fidèle au backend Sprint 1, avec une liste de missions persistantes et une vue détail minimale.

### fichiers à créer

- `desktop/src/pages/Missions.tsx`
- `desktop/src/pages/MissionDetail.tsx`
- `desktop/src/components/mission-control/MissionHeader.tsx`
- `desktop/src/components/mission-control/ContractsPreview.tsx`
- `desktop/src/components/mission-control/ArtifactsPreview.tsx`
- `desktop/src/components/mission-control/RecordsPreview.tsx`
- `desktop/src/components/mission-control/ResumeActions.tsx`
- `desktop/src/hooks/useMissions.ts`
- `desktop/src/hooks/useMissionDetail.ts`

### fichiers à modifier

- `desktop/src/App.tsx` ou le fichier de routing actuellement utilisé par le desktop si différent sur la branche réelle
- `desktop/src/pages/Overview.tsx` uniquement si un lien clair vers la nouvelle vue missionnelle y est ajouté, sans réutiliser ses zones mockées
- Le composant de navigation existant si une entrée “Missions” y est ajoutée sur la branche réelle

### dépendances

- Sous-bloc E terminé
- DTOs backend stables
- Design UI minimal accepté : liste + détail + actions minimales seulement

### risques

- Réintroduire des mocks pour “faire joli” alors que le backend ne produit pas encore la donnée
- Copier la logique Mission Control complète des specs au lieu de rester dans un détail minimal réellement supporté
- Laisser l’UI recalculer son propre état principal au lieu de relire la projection backend
- Ajouter des cartes ou panels vides qui donnent une fausse impression de capacité

### critères de done

- Une vue liste permet de voir des missions persistantes réelles
- Une vue détail permet de comprendre l’état général d’une mission à partir de la projection backend
- Les actions pause, resume et refresh utilisent les commandes Tauri Sprint 1 réelles
- Les sections contrats, artefacts, décisions, validations et resume ne s’affichent que si des données réelles existent
- Aucun composant de cette nouvelle surface n’est piloté par `events.jsonl`, `state.json` ou des mocks React pour l’état missionnel principal

### validation manuelle

- Créer une mission depuis l’UI
- Vérifier qu’elle apparaît dans la liste sans rechargement incohérent
- Ouvrir le détail mission, fermer puis relancer l’application, puis vérifier que l’état affiché reste identique
- Mettre en pause puis reprendre une mission et vérifier que le détail reflète la transition réelle

### ce qui est explicitement hors périmètre

- Cockpit Mission Control complet
- Vue multi-mission avancée
- Evidence explorer
- Intervention avancée
- Timeline riche
- Design “chat centric” ou console de logs

## 11. Exact execution order

1. Exécuter le sous-bloc A et figer la conclusion d’audit avant tout développement applicatif
2. Si et seulement si l’audit révèle un manque bloquant, implémenter le delta minimal de schéma validé. Sinon, passer directement au sous-bloc B
3. Implémenter le sous-bloc B pour centraliser l’accès aux tables déjà existantes
4. Implémenter le sous-bloc C pour formaliser les cas d’usage Sprint 1
5. Transformer `mission_coordinator.rs` dans le sous-bloc D en autorité backend mission-centric minimale
6. Exposer les commandes Tauri et DTOs du sous-bloc E
7. Construire la surface desktop minimale du sous-bloc F sur le contrat backend réellement disponible
8. Faire une validation end-to-end avec redémarrage applicatif et reprise minimale
9. Corriger uniquement les écarts bloquants observés pendant la validation finale, sans élargir le scope

## 12. Risks and failure modes

- Audit de schéma bâclé conduisant à des deltas inutiles
- Couche repository incomplète laissant survivre des accès SQL dispersés
- Services trop minces ou trop ambitieux
- Mission Coordinator sans vraie autorité, donc retour implicite à un système piloté par les runs et les logs
- DTOs backend trop riches et non réellement alimentés
- Frontend qui réintroduit des mocks ou recalcule la vérité missionnelle
- Tentation de connecter trop tôt le bridge complet vers le moteur CLI, ce qui ferait dériver Sprint 1 vers Sprint 2
- Conflit entre l’ancien centre de gravité run-centric et le nouveau centre de gravité mission-centric si les frontières de responsabilité ne sont pas strictement fixées

## 13. Done criteria per sub-block

### Sub-block A

- Audit table par table terminé
- Décision finale explicite sur chaque delta éventuel
- Conclusion officielle figée avant de toucher la couche applicative

### Sub-block B

- Tous les accès DB missionnels Sprint 1 passent par la couche repository
- Les entités minimales nécessaires se relisent correctement depuis PostgreSQL

### Sub-block C

- Les cas d’usage Sprint 1 existent comme services explicites
- Pause et reprise minimale fonctionnent côté métier

### Sub-block D

- Le Mission Coordinator devient l’entrée backend mission-centric unique pour Sprint 1
- Le coordinator met à jour le state canonique au lieu de dépendre des logs

### Sub-block E

- Les commandes Tauri et DTOs sont stables, minimaux et réellement alimentés
- Le frontend n’a pas besoin d’inventer ou de reconstruire l’état principal

### Sub-block F

- Le desktop affiche une liste et un détail mission strictement réels
- L’UI survit au redémarrage et reflète correctement pause / reprise

## 14. Final Sprint 1 done criteria

Sprint 1 est terminé uniquement si les conditions suivantes sont toutes vraies.

- Le schéma Sprint 0 a été audité sans reconstruction inutile
- Aucun delta de schéma n’a été appliqué sans justification directe depuis un cas d’usage Sprint 1
- Une mission persistante peut être créée et relue après redémarrage de l’application
- Un charter, un case file et une projection initiale existent réellement pour cette mission
- Un premier contrat peut être admis et relu dans le détail mission
- La projection missionnelle minimale est lue depuis PostgreSQL via le Mission Coordinator
- Le desktop peut lister les missions persistantes et ouvrir leur détail sans dépendre des logs bruts
- Pause et reprise minimales passent par le Mission Coordinator et laissent un état cohérent en base
- Aucun écran Sprint 1 ne prétend afficher des capacités backend non produites réellement
- Le centre de gravité du produit a commencé à basculer du run éphémère vers la mission persistante, sans refonte lourde de l’exécution

## Recommended first implementation step

La meilleure première étape à implémenter immédiatement après validation de ce plan est le sous-bloc A, avec une seule cible opérationnelle : auditer le schéma réel déjà livré dans `desktop/src-tauri/migrations/` et produire une décision formelle, table par table, sur l’existence ou non d’un delta strictement nécessaire pour le flux Sprint 1.

Pourquoi cette étape est la bonne première étape :

- elle verrouille définitivement le point le plus sensible du sprint sans rouvrir Sprint 0
- elle empêche toute reconstruction déguisée du schéma
- elle conditionne proprement les repositories, services, DTOs et la UI minimale
- elle permet de démarrer ensuite l’implémentation applicative sur une base figée et non spéculative

Tant que cette décision n’est pas prise, toute implémentation des sous-blocs B à F risquerait d’introduire soit du code prématuré, soit des hypothèses de schéma non vérifiées.
