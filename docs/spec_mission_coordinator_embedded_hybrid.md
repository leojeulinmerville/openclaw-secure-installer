spec_mission_coordinator_embedded_hybrid
1. Objet de la spec

Cette spec définit le coordinateur minimal persistant nécessaire pour faire vivre le noyau missionnel défini dans la première spec.

Son rôle est de transformer le système actuel, encore largement structuré autour de runs éphémères et d’une orchestration dispersée, en un système capable de maintenir une mission persistante, de gérer son état canonique, de suivre sa trajectoire, de supporter la reprise, et d’exposer une projection fiable à Mission Control.

Cette spec ne décrit pas encore une architecture distribuée complète. Elle décrit la cible court terme recommandée : un modèle Embedded Hybrid.

2. But produit

À la fin de cette couche, le système doit être capable de :

maintenir une mission vivante indépendamment du seul cycle de vie d’un run ponctuel
mettre à jour l’état canonique de mission à mesure que des événements significatifs arrivent
supporter une exécution séquencée ou partiellement concurrente sans perdre la source de vérité
produire une projection Mission Control minimale stable
reprendre une mission après interruption
servir de point d’ancrage aux futures couches de gouvernance, d’intervention, de preuve et de branching

3. Principe général

Le système actuel ne doit plus reposer seulement sur :
des appels directs depuis le desktop,
des sous processus ponctuels,
et des logs append only comme principal fil de vérité.

Il faut introduire un coordinateur missionnel persistant.

Ce coordinateur n’est pas encore un orchestrateur distribué lourd.
Ce n’est pas non plus seulement un wrapper autour du CLI.
C’est un composant central de coordination locale persistante.

La forme recommandée à ce stade est :

un Mission Coordinator local ou quasi local
adossé à une base canonique PostgreSQL
connecté au desktop
capable de lancer, suivre, réconcilier et reprendre des activations opérationnelles
tout en gardant la mission comme unité première

4. Pourquoi “Embedded Hybrid”

Le modèle Embedded Hybrid est recommandé comme prochaine étape parce qu’il constitue un bon compromis entre :
simplicité de départ,
cohérence produit,
et capacité d’évolution.

Il évite deux erreurs opposées :

première erreur
rester dans un modèle entièrement éphémère et trop lié au frontend

deuxième erreur
basculer trop tôt vers une architecture distribuée lourde avec trop de composants, de files, de workers et de complexité d’exploitation

Le modèle Embedded Hybrid veut dire ici :

un coordinateur persistant intégré au produit actuel
une orchestration locale ou semi locale
une base canonique partagée
des activations opérationnelles encore relativement proches du desktop
mais une séparation claire entre :
surface UI,
coordination missionnelle,
et exécution

5. Responsabilité du Mission Coordinator

Le Mission Coordinator doit porter les responsabilités suivantes.

5.1 Création et activation de mission

Recevoir la demande de création de mission issue du desktop ou d’une autre entrée autorisée.
Créer les objets minimaux :
Mission,
Mission Charter,
Case File,
projection initiale.

5.2 Pilotage de trajectoire

Maintenir la trajectoire de référence.
Connaître la phase dominante courante.
Suivre les contrats actifs.
Savoir si la mission est en exécution normale, en review, en reprise, en recovery ou en pause.

5.3 Mise à jour de l’état canonique

Appliquer les mises à jour importantes sur les objets de mission.
Ne pas laisser les logs bruts devenir l’unique vérité.
Être le point de réconciliation entre ce qui s’exécute et ce qui devient vrai dans l’état canonique.

5.4 Gestion des activations opérationnelles

Démarrer ou relier un run opérationnel à une mission existante.
Associer les sorties importantes d’exécution à des contrats, artefacts, validations ou décisions.
Maintenir le lien entre épisode d’exécution et mission persistante.

5.5 Projection Mission Control

Maintenir ou déclencher la mise à jour de la projection minimale lue par Mission Control.

5.6 Reprise

Savoir reconstruire une mission à partir de la base canonique.
Produire ou relire un resume snapshot.
Décider si la reprise est directe, prudente ou nécessite requalification minimale.

5.7 Journalisation de responsabilité

Tracer au minimum :
qui a porté une décision significative,
quel niveau logique,
quel mode de contrôle,
et quand.

6. Ce que le Mission Coordinator n’est pas encore

Pour éviter les confusions, ce coordinateur n’est pas encore :

un moteur de policy avancé complet
un scheduler distribué complexe
un bus d’événements complet multi machine
un moteur de workflow type Temporal
un comité engine complet
un capability registry complet
un orchestrateur final de toute la cible V2

Il est le noyau de coordination persistant minimal qui permet au reste d’exister proprement.

7. Architecture logique minimale

Je recommande de penser cette architecture en quatre blocs.

7.1 Surface de contrôle

Le desktop reste la surface utilisateur principale :
création de mission,
lecture de l’état,
affichage Mission Control,
déclenchement d’actions autorisées,
interventions humaines.

7.2 Mission Coordinator

Bloc central persistant.
Il reçoit les commandes de haut niveau.
Il manipule les objets missionnels.
Il écrit dans la base canonique.
Il déclenche ou surveille les activations opérationnelles.
Il met à jour la projection missionnelle.

7.3 Activation opérationnelle

Les runs, processus, appels moteur, workers ou exécutions effectives vivent ici.
Ils ne deviennent pas eux mêmes la vérité canonique.
Ils remontent des événements, des résultats et des signaux vers le coordinateur.

7.4 Base canonique

PostgreSQL comme source de vérité.
Tous les objets fondamentaux minimaux y résident.
La reprise et la projection Mission Control en dépendent.

8. Flux minimal à supporter
8.1 Création de mission

Le desktop envoie une demande de mission.

Le Mission Coordinator crée Mission, Charter, Case File, projection initiale.

La mission reçoit un statut initial.

Le système peut ensuite admettre un premier contrat.

8.2 Admission d’un premier contrat

Le coordinateur reçoit une demande de contrat initial.

Il crée le Contract.

Il met à jour la Mission State Projection.

Il décide s’il faut lancer immédiatement une activation opérationnelle ou attendre.

8.3 Lancement d’une activation opérationnelle

Le coordinateur lance ou relie un run.

Le run reçoit un lien explicite vers mission_id et contract_id.

Les événements d’exécution utiles remontent.

Les objets canoniques sont mis à jour à partir des signaux significatifs.

8.4 Fin ou interruption d’un run

Le coordinateur observe la fin, l’échec, l’arrêt ou l’interruption.

Il réconcilie le résultat avec l’état canonique.

Il crée si nécessaire un Decision Record, Validation Record ou Resume Snapshot.

Il met à jour la projection missionnelle.

8.5 Reprise

Le desktop ou un trigger demande la reprise.

Le coordinateur recharge Mission, Case File, Contracts actifs, projection courante, dernier snapshot.

Il vérifie la fraîcheur minimale.

Il choisit un mode de reprise.

Il met à jour l’état puis peut relancer une activation opérationnelle.

9. Modèle d’événements minimal

Même sans construire tout de suite un event bus complet, il faut définir des types d’événements significatifs que le coordinateur sait interpréter.

Je recommande au minimum :

mission.created
mission.framed
contract.created
contract.admitted
contract.started
contract.blocked
contract.completed
contract.failed
artifact.created
artifact.updated
artifact.validated
artifact.accepted
decision.recorded
validation.recorded
resume.snapshot.created
mission.paused
mission.escalated
mission.completed
mission.aborted

Ces événements ne doivent pas forcément tous devenir publics tout de suite, mais le coordinateur doit déjà raisonner avec eux.

10. Source de vérité

Le Mission Coordinator doit être le composant qui décide ce qui devient vrai dans la base canonique.

Très important :
les logs bruts, stdout/stderr, events.jsonl, états UI temporaires ou outputs de processus ne sont pas la vérité finale.
Ils sont des signaux ou des preuves de bas niveau.
La vérité canonique est ce que le coordinateur a reconnu, interprété et écrit comme état missionnel.

11. Relation avec l’existant

La logique d’implémentation doit privilégier l’incrémentation plutôt que la refonte totale.

Cela implique :

ne pas jeter immédiatement les runs existants
ne pas supprimer d’emblée les logs existants
ne pas essayer de réécrire toute l’interface
ne pas introduire immédiatement un orchestreur externe lourd

À la place, il faut insérer le Mission Coordinator comme nouvelle couche d’autorité entre :
le desktop
et
l’exécution existante

Autrement dit :
on garde le moteur existant autant que possible,
mais on change le centre de gravité du système.

12. Choix d’implémentation recommandé à ce stade
12.1 Coordinateur dans la couche locale du produit

Court terme recommandé :
faire vivre le coordinateur dans la couche la plus proche du produit actuel, avec une persistance réelle et une API propre.

Deux trajectoires sont plausibles techniquement :
un coordinateur côté backend Rust/Tauri
ou
un coordinateur Node persistant proche du moteur existant

La présente spec ne tranche pas encore définitivement entre Rust et Node.
Elle impose en revanche la responsabilité fonctionnelle du coordinateur.

12.2 PostgreSQL

PostgreSQL recommandé comme store canonique principal.

12.3 API interne claire

Le coordinateur doit exposer une interface claire pour :
create mission
get mission state
list active contracts
start contract activation
record decision
record validation
create resume snapshot
resume mission

Même si cette API n’est d’abord consommée que par le desktop, elle doit être pensée comme API interne propre.

13. Projection minimale à maintenir

Le coordinateur doit maintenir une projection lisible par Mission Control MVP.

Cette projection doit au minimum inclure :

mission_id
title
mode
phase
status
health_state
governance_state
reference_path
current_focus
top_blocker
top_risk
active_contract_count
last_decision_summary
last_validation_summary
resume_readiness
needs_human_attention
updated_at

14. Critères de réussite

Cette spec sera considérée comme correctement implémentée quand le système pourra :

créer une mission persistante réelle
lui attacher des contrats persistants
lancer un run lié explicitement à mission_id et contract_id
mettre à jour l’état missionnel sans dépendre seulement des logs bruts
produire une projection Mission Control minimale
reprendre une mission après interruption
faire exister une autorité canonique de coordination distincte de la simple UI

15. Ce que cette spec prépare

Une fois cette spec en place, le terrain devient prêt pour :

Mission Control MVP réel
recovery minimal mieux intégré
intervention minimale gouvernée
state model enrichi
evidence plus structurée
branching gouverné progressif
capability registry plus tard

16. Décision à prendre juste après cette spec

Le point d’arbitrage principal à prendre après cette spec est :
où incarner exactement le Mission Coordinator en première itération,
Rust/Tauri backend ou couche Node persistante,
sans perdre l’objectif central :
un centre missionnel persistant, distinct de la UI et distinct des seuls runs.
