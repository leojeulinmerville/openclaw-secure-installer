spec_mission_control_mvp
1. Objet de la spec

Cette spec définit la première version réellement utile de Mission Control.

Son objectif n’est pas de construire tout de suite l’interface finale de supervision du système cible. Son objectif est de définir la plus petite surface utilisateur cohérente avec la V2, le decision memo, le noyau missionnel persistant et le Mission Coordinator.

Mission Control MVP doit donc être compris comme la première projection supervisable du système. Il doit rendre visible la mission persistante, sa trajectoire de référence, son état courant, ses principaux objets actifs, ses derniers événements significatifs et les points de levier humains utiles.

2. But produit

À la fin de cette couche, l’utilisateur doit pouvoir :

voir une mission réelle, persistante et non un simple run brut
comprendre où en est la mission sans relire les logs
voir la trajectoire de référence
voir les principaux contrats actifs ou bloqués
voir les artefacts récents ou importants
voir les derniers événements de gouvernance significatifs
savoir si la mission a besoin d’attention humaine
reprendre une mission interrompue
déclencher quelques actions utiles à fort levier, sans télécommander tout le moteur

Le MVP ne cherche pas encore :
une Evidence Explorer complète
une Branching View complète
une interface riche de comités
une console complète de capability registry
une projection exhaustive de tous les plans transverses

Il cherche à rendre la mission intelligible et gouvernable au niveau minimal nécessaire.

3. Principe général

Mission Control MVP ne doit pas être un chat enrichi ni un dashboard purement métrique.

Il doit être une vue de supervision orientée mission.

Sa règle principale est simple :
l’utilisateur doit comprendre l’état missionnel courant à partir d’une projection stable issue de l’état canonique, et non à partir d’un bricolage sur les logs bruts ou sur des composants UI isolés.

Mission Control MVP doit donc lire principalement :
Mission
Mission State Projection
Case File résumé
Contracts actifs
Artifacts récents
Decision Records récents
Validation Records récents
Resume Snapshot le plus récent si pertinent

4. Vue principale à construire

Je recommande que Mission Control MVP soit centré sur une page missionnelle principale, structurée autour de six blocs.

4.1 Mission Header

Rôle :
donner immédiatement l’identité et le statut général de la mission.

Contenu minimal :

titre de mission
mission_id court ou identifiant lisible
mode de mission
phase dominante
status
health state
governance state
date de dernière mise à jour
resume readiness
indicateur “needs human attention”

Ce bloc doit répondre immédiatement à :
de quelle mission parle-t-on
dans quel régime tourne-t-elle
faut-il que l’utilisateur regarde plus en profondeur

4.2 Reference Trajectory Panel

Rôle :
rendre visible la voie principale de convergence.

Contenu minimal :

label ou identifiant de la trajectoire de référence
focus courant
current next best action
top blocker
top risk
état de progression haute niveau
dernier point de bascule significatif si présent

Ce bloc est essentiel pour éviter que Mission Control ne se réduise à une liste d’événements.

4.3 Active Contracts Panel

Rôle :
montrer ce qui travaille réellement en ce moment.

Contenu minimal :

liste courte des contracts actifs, bloqués ou under_review
pour chaque contract :
type
titre
status
health state
assigned role
updated_at

Ce bloc doit rester synthétique dans le MVP.
Il faut une vue compacte, pas un explorateur exhaustif.

4.4 Recent Artifacts Panel

Rôle :
montrer ce qui a réellement été produit ou modifié.

Contenu minimal :

artefacts récents ou importants
type
nom
statut
promotion state
origine contractuelle si disponible
updated_at

Le but n’est pas encore d’explorer tout le système de fichiers.
Le but est de relier mission, production et statut d’acceptabilité.

4.5 Decision and Validation Feed

Rôle :
montrer les dernières décisions et validations significatives.

Contenu minimal :

2 à 10 items récents maximum
type d’événement
résumé court
outcome
responsibility level
responsibility role
timestamp

Cette zone doit servir de premier point d’explicabilité.
Elle doit montrer que le système ne “fait pas juste des choses”, il prend aussi des décisions traçables.

4.6 Resume and Actions Panel

Rôle :
offrir les actions humaines minimales utiles.

Contenu minimal :

resume snapshot le plus récent ou son résumé
recommanded resume mode si pertinent
actions disponibles :
resume mission
pause mission
refresh state
open details
add intervention
view latest records

On ne cherche pas encore une matrice d’actions très riche.
Le MVP doit surtout permettre :
reprise,
pause,
lecture,
intervention minimale.

5. Actions humaines minimales à supporter

Je recommande de limiter le MVP à un petit nombre d’actions gouvernables.

5.1 Resume Mission

Permet de demander la reprise d’une mission interrompue ou inactive.

Effet attendu :
appeler le Mission Coordinator,
recharger l’état,
lancer un resume flow minimal.

5.2 Pause Mission

Permet de passer une mission active en pause gouvernée.

Effet attendu :
ne pas tuer aveuglément tout,
mais enregistrer une transition propre et préparer une reprise.

5.3 Add Intervention

Permet à l’utilisateur de soumettre une intervention minimale ciblée.

Dans le MVP, cette intervention peut rester volontairement simple :
texte
scope choisi dans une liste limitée
priorité simple
type simple si possible

L’objectif n’est pas encore d’avoir toute l’UX d’intervention avancée, mais de ne pas bloquer l’entrée de la logique “human on the loop”.

5.4 Open Details

Permet d’ouvrir une vue plus détaillée sur :
contracts
artifacts
decision records
validation records
resume snapshot

Même si ces vues restent rudimentaires au départ, elles doivent être prévues.

6. Ce que Mission Control MVP ne doit pas faire

Pour éviter l’échec du MVP, il faut fixer ce qu’il n’est pas.

Il ne doit pas être une console brute de logs.
Il ne doit pas être un simple chat.
Il ne doit pas prétendre afficher une gouvernance riche si le backend ne la produit pas encore.
Il ne doit pas exposer toute la complexité du système dès le départ.
Il ne doit pas dépendre d’un parsing fragile des sorties terminal.
Il ne doit pas faire croire à un état missionnel s’il n’existe pas en backend.

Autrement dit :
Mission Control MVP doit être sobre mais vrai.

7. Source des données

Mission Control MVP doit être alimenté principalement par le Mission Coordinator et la base canonique, pas par la seule UI locale ni par un simple scraping de logs.

Les sources minimales sont :

Mission
Mission State Projection
Case File résumé
Contracts
Artifacts
Decision Records
Validation Records
Resume Snapshot

Les logs bruts peuvent rester accessibles plus tard dans une vue technique, mais ils ne doivent pas piloter l’état principal affiché.

8. Modèle de projection UI minimal

Je recommande d’introduire explicitement une projection UI missionnelle minimale, par exemple un objet de type :

MissionControlMissionView

Champs minimaux recommandés :

mission_id
title
mode
phase
status
health_state
governance_state
reference_path_label
current_focus
current_next_best_action
top_blocker
top_risk
resume_readiness
needs_human_attention
last_decision_summary
last_validation_summary
active_contracts_preview
recent_artifacts_preview
updated_at

Cet objet peut être une projection backend dédiée ou une agrégation service side.
L’important est qu’il existe comme contrat clair entre backend et UI.

9. Navigation minimale recommandée

Je recommande une structure simple.

Vue liste missions

Même si rudimentaire au début, il faut pouvoir lister les missions persistantes.

Colonnes minimales :
titre
mode
status
phase
health state
updated_at
needs human attention

Vue détail mission

C’est la vue principale décrite dans cette spec.

Vue détails secondaires

Peuvent être de simples drawers, tabs ou sous pages pour :
contracts
artifacts
records
resume

Pas besoin de sophistication excessive au premier jet.

10. Design UX recommandé

Le MVP doit privilégier :

lisibilité
densité contrôlée
progressive disclosure
cohérence avec la logique de mission
stabilité des concepts visibles

Il faut éviter :
un design purement chat centric
un mur de cartes sans hiérarchie
une interface qui affiche des concepts V2 non encore réellement supportés
une granularité trop fine trop tôt
une colorisation dramatique artificielle

La priorité n’est pas la “coolness” de l’interface.
La priorité est la clarté de supervision.

11. États visuels minimaux

Les objets principaux visibles doivent exposer des états lisibles.

Mission :
draft
framed
active
paused
escalated
completed
aborted

Health :
stable
degraded
critical

Governance :
normal
under_review
escalated
guarded

Contracts :
admitted
running
blocked
under_review
validated
failed
completed

Artifacts :
generated
in_review
validated
accepted
rejected

Ce vocabulaire doit être cohérent avec la spec 1 et la projection backend.

12. Critères de réussite

Cette spec sera considérée comme correctement implémentée quand un utilisateur pourra :

voir une liste de missions persistantes
ouvrir une mission et comprendre son état général
identifier la trajectoire de référence et le focus courant
voir les contrats majeurs actifs ou bloqués
voir les artefacts récents
voir les dernières décisions et validations significatives
reprendre ou mettre en pause une mission
soumettre une intervention minimale
faire tout cela sans dépendre du log brut pour comprendre la situation

13. Ce que cette spec prépare

Une fois Mission Control MVP en place, il devient possible d’ajouter ensuite :

une vue de branching plus riche
une vue evidence explorer
une vue recovery console
une vue intervention avancée
une projection des responsibility ledger entries
une vue de capability registry
une supervision multi mission plus avancée

14. Conséquence directe

Une fois cette troisième spec validée, vous avez les trois premiers artefacts suffisants pour passer de la phase de constitution produit à la phase de design buildable :

spec 1 : quoi stocker
spec 2 : qui coordonne
spec 3 : ce que l’utilisateur voit et pilote

La prochaine étape logique après ces specs est :
transformer cela en backlog d’implémentation priorisé et en premiers sprints.
