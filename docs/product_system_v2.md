1.	Nature et purpose du document
Ce document n’est ni un simple compte rendu de brainstorming, ni une note de vision générale, ni une présentation marketing du produit. Il a pour fonction de servir de référence conceptuelle maîtresse pour le système cible en cours de conception à partir de la base actuelle issue d’une fork d’OpenClaw et d’une application desktop no code de setup et d’exploitation.
Il doit être lu comme une constitution système. Son rôle est de fixer la doctrine du produit, ses primitives fondamentales, ses objets reconnus, ses mécanismes de contrôle, ses formes de gouvernance, ses régimes d’autonomie, ses principes de confiance, ainsi que les règles de cohérence qui devront guider l’architecture, le backend, l’UX, la sécurité, la roadmap et les arbitrages futurs.
Le système décrit ici ne constitue pas une description fidèle de l’état actuel de l’implémentation. Il décrit le produit cible que la base actuelle doit progressivement devenir. La valeur de ce document réside donc dans sa capacité à stabiliser un langage commun, à éviter les dérives de conception, à aligner les futures décisions produit, et à fournir un cadre durable de lecture du système au delà des choix techniques temporaires.
Ce document doit rester suffisamment stable pour servir de socle, suffisamment précis pour guider le design, suffisamment clair pour être transmis à d’autres contributeurs, et suffisamment évolutif pour permettre l’extension du système sans rupture de cohérence.
2.	Thèse produit, vision et positionnement
Le produit visé n’est pas un agent de plus, ni un assistant conversationnel classique, ni un simple cockpit sur un runtime existant. Le système cible doit être compris comme une organisation computationnelle gouvernée, conçue pour transformer une intention humaine simple en travail logiciel exécutable, supervisable, traçable, récupérable et améliorable dans le temps.
Sa vocation n’est pas seulement d’aider un utilisateur à produire du code ou à enchaîner des outils. Sa vocation est de rendre possible une production logicielle autonome de plus haut niveau, sans renoncer à l’explicabilité, à la qualité, à la gouvernance, à la récupération sous dégradation ni à la capacité d’intervention humaine à fort levier.
Le système repose sur plusieurs convictions fondatrices.
Premièrement, un problème de production numérique, et en particulier de production logicielle, peut être transformé en trajectoires de travail gouvernées plutôt qu’en simples suites de prompts ou d’actions locales. La valeur ne vient donc pas uniquement du modèle utilisé, mais de la capacité à structurer le travail, à le distribuer, à le superviser, à le corriger, à le prouver et à le faire converger.
Deuxièmement, l’open source, l’auto hébergement et le contrôle de l’infrastructure restent des choix structurants, non seulement pour des raisons de coût, mais surtout pour des raisons de souveraineté, de traçabilité, d’auditabilité et de flexibilité systémique. Le système cible doit pouvoir vivre dans des environnements locaux, conteneurisés ou répartis, sans être conceptuellement dépendant d’un fournisseur propriétaire unique.
Troisièmement, la confiance ne doit pas venir d’un modèle unique supposé intelligent, ni d’une interface séduisante, ni d’un enfermement technique trop restrictif. Elle doit émerger d’un ensemble cohérent de mécanismes : gouvernance distribuée, séparation partielle des responsabilités, preuves structurées, transitions contrôlées, validation proportionnée, récupération gouvernée, continuité missionnelle, supervision utile et sécurité by design.
Quatrièmement, l’autonomie du système ne doit pas être pensée comme une liberté absolue d’agir ou de raisonner sans limite. Elle doit être une autonomie gouvernée, capable de poursuivre une mission sans dépendance humaine régulière, tout en sachant réguler sa propre profondeur de réflexion, sa densité de contrôle, ses besoins d’escalade, son intensité de branching et ses conditions de clôture.
Cinquièmement, la transparence visée n’est pas une transparence brute ou décorative. Il ne s’agit pas seulement d’afficher des logs ou de streamer un raisonnement. Il s’agit de rendre le système supervisable de manière utile, c’est à dire capable de montrer où en est une mission, quelle trajectoire est active, quels objets sont sous contrôle, quelles décisions ont été prises, sur quelles preuves, sous quelle responsabilité, et avec quelles possibilités d’intervention ou de contestation.
À ce titre, le système ne doit pas être confondu avec plusieurs catégories voisines mais insuffisantes.
Il ne doit pas être réduit à un assistant conversationnel qui attend l’utilisateur à chaque étape.
Il ne doit pas être réduit à un agent monolithique qui planifie, exécute, valide et décide seul sans contrepoids.
Il ne doit pas être réduit à une simple interface no code sur un moteur existant.
Il ne doit pas être réduit à un orchestrateur multi outils où la qualité dépend seulement de la puissance du modèle ou du nombre de connecteurs.
Il ne doit pas non plus être réduit à un environnement trop bridé dont la sûreté viendrait uniquement d’une restriction brutale des capacités.
Le système cible doit au contraire être pensé comme un système de production autonome gouverné. Il doit pouvoir orchestrer des rôles spécialisés, piloter plusieurs trajectoires de travail, produire et manipuler des objets de travail gouvernés, justifier ses décisions, traverser des dégradations de trajectoire, récupérer proprement, reprendre dans le temps, rester supervisable par l’humain, et améliorer progressivement ses moyens d’action sans perdre sa cohérence fondamentale.
Les piliers non négociables du produit cible sont les suivants.
Autonomie prolongée par défaut.
Human on the loop et non dépendance à l’humain pour l’avancement normal.
Gouvernance interne distribuée.
Qualité avant vitesse brute, avec convergence gouvernée.
Transparence utile et non black box.
Objets de travail gouvernés et traçables.
Preuves comme base de décision.
Récupération et continuité natives.
Capacité gouvernée plutôt que restriction aveugle.
Architecture open source et auto hébergeable.
Le système décrit dans ce document doit donc être compris comme un produit cible plus large que son implémentation actuelle. La base actuelle n’en constitue que le point d’appui. L’ambition de cette V2 est de définir ce que ce produit doit devenir au niveau conceptuel, avant de figer entièrement son nom, son architecture technique finale ou son packaging produit. Autrement dit, ce document ne spécifie pas simplement une application, mais la logique d’un système autonome gouverné que l’application devra progressivement rendre opérable.

3.	Doctrine d’autonomie et place de l’humain
OpenClaw est conçu pour fonctionner en autonomie prolongée. Son mode nominal n’est pas celui d’un système qui attend une intervention humaine régulière pour progresser, ni celui d’un moteur fermé qui agit sans possibilité de supervision. Son mode nominal est celui d’un système gouverné dans lequel l’humain reste sur la boucle, et non dans la boucle.
Cela signifie que l’humain n’est pas requis pour faire avancer l’exécution normale d’une mission. Le système doit pouvoir recevoir une intention, construire une mission, activer son cadre de gouvernance, produire du travail, le superviser, le valider, le corriger, le récupérer sous dégradation et le clôturer sans dépendre d’un suivi humain continu.
En revanche, l’humain conserve plusieurs rôles légitimes et structurants.
Il peut être auteur d’intention en formulant un besoin initial ou en requalifiant un objectif.
Il peut être superviseur en observant l’état courant du système, de la mission, des branches, des artefacts, des validations et des risques actifs.
Il peut être modulateur live en intervenant sur une tâche, une trajectoire, un artefact, une décision ou un régime local de gouvernance.
Il peut être autorité d’arbitrage lorsque la policy exige une ratification, une approbation ou une décision humaine sur certaines classes d’actions.
Il peut enfin être lecteur d’explication et d’audit, c’est à dire comprendre a posteriori la trajectoire suivie, les preuves mobilisées, les responsabilités engagées et les raisons des décisions prises.
La capacité d’intervention humaine doit être maximale quand l’humain est présent, mais la dépendance structurelle à l’humain doit être minimale pour le fonctionnement normal du système. C’est une doctrine fondamentale. Le produit ne doit ni attendre passivement l’utilisateur à chaque étape, ni l’exclure de la gouvernance réelle.
Certaines transitions, certaines promotions, certains changements de régime ou certaines actions à fort impact peuvent néanmoins rester soumises à une policy d’approbation humaine. L’autonomie n’est donc pas uniforme. Elle est variable selon la classe d’action, le mode de mission, le blast radius, le niveau de preuve disponible et le profil de risque actif. Par défaut, l’humain n’est pas requis. Mais certaines décisions peuvent l’être, selon des règles explicites du système.
Cette doctrine suppose également que l’intervention humaine ne soit jamais traitée comme une injection naïve dans le moteur. Un message humain n’est pas automatiquement une action exécutable. Il doit être interprété, contextualisé, qualifié, évalué en impact, résolu selon son type et sa souveraineté, puis appliqué, différé, réorienté ou refusé selon la policy active. L’humain n’agit donc pas comme un téléopérateur continu du système. Il intervient dans une structure gouvernée.
La valeur du human on the loop dépend aussi de la qualité de la supervisabilité. L’humain ne doit pas être noyé dans un flux d’informations brutes. Mission Control doit l’aider à superviser intelligemment, en mettant en avant les états significatifs, les points de bascule, les objets en revue, les transitions sensibles, les conflits de preuve, les recoveries en cours, les obligations pendantes et les points d’intervention à fort levier.
L’autonomie visée doit enfin être une autonomie disciplinée. Le système ne doit pas seulement savoir continuer sans humain. Il doit aussi savoir s’auto réguler. Il doit gouverner sa propre profondeur de réflexion, son intensité d’action, ses cycles de contrôle, ses branches d’exploration et ses besoins d’escalade, afin de converger vers une sortie suffisamment bonne, gouvernable et explicable, sans tomber dans l’overthinking, l’itération improductive ou l’inflation cognitive.
Toute boucle cognitive doit avoir une finalité explicite. Elle doit réduire une incertitude, préparer une décision, justifier une transition, prévenir un risque significatif ou améliorer un output critique.
Toute boucle cognitive doit avoir une condition de sortie. Elle doit pouvoir déboucher sur une action, une validation, un rejet, une escalade, un gel, un résumé, une clôture partielle ou un arrêt propre.
La profondeur de réflexion doit être proportionnée à l’enjeu. Les objets critiques, ambigus ou risqués justifient davantage de délibération que les tâches locales, réversibles et peu sensibles.
La réflexion elle même doit être gouvernée par valeur marginale attendue. Un tour supplémentaire n’est justifié que s’il augmente encore significativement la qualité, la sûreté, la clarté ou la réduction d’incertitude.
La compression doit être reconnue comme une sortie légitime du raisonnement. Le système doit pouvoir condenser son thinking en état consolidé, rationale synthétique, preuves clés, questions ouvertes et prochaine action recommandée.
En ce sens, l’autonomie mature ne consiste pas à penser le plus longtemps possible. Elle consiste à penser suffisamment, agir au bon moment, escalader si nécessaire, et savoir s’arrêter lorsque le gain devient marginal.
4.	Architecture institutionnelle du système
OpenClaw repose sur une hiérarchie stable de responsabilité en cinq niveaux. Cette hiérarchie ne doit pas être lue comme un organigramme technique figé, mais comme une structure logique de responsabilité et d’autorité. Sa fonction n’est pas de centraliser toutes les décisions, mais d’appliquer un principe de subsidiarité : chaque niveau traite ce qu’il peut légitimement traiter et ne remonte que ce qui dépasse son périmètre, son niveau de confiance, son autorité ou son seuil de risque.
Cette hiérarchie organise non seulement qui agit, mais qui borne, qui autorise, qui coordonne, qui produit et qui améliore le système dans le temps.
Le premier niveau est le niveau Policy / Constitution. Il borne le système. Il fixe les invariants, les profils de risque, les scopes de capacité, les règles d’admission, de promotion, de sécurité, de continuité et d’escalade. Il ne produit pas directement le travail missionnel. Il fixe les lois durables dans lesquelles ce travail peut légitimement avoir lieu.
Le deuxième niveau est le niveau de Gouvernance stratégique. Il interprète les policies dans le contexte vivant de la mission. Il ajuste le régime de contrôle, arbitre les conflits majeurs, déclenche les comités, ratifie certaines transitions importantes, intensifie ou relâche la gouvernance selon le mode de mission et la situation observée.
Le troisième niveau est celui de l’Orchestration tactique. Il transforme la mission en trajectoires opérables. Il planifie, route, reconfigure, synchronise, gère les branches, les contrats, les ressources, les dépendances et les replans. C’est le cerveau de coordination de la mission.
Le quatrième niveau est celui des Opérateurs spécialisés. Il produit le travail effectif. Il interprète, analyse, recherche, conçoit, implémente, teste, documente, diagnostique et transforme. C’est à ce niveau que les contrats deviennent actions et que les artefacts sont effectivement produits ou modifiés.
Le cinquième niveau est celui de l’Audit et de l’apprentissage. Il relit les trajectoires passées et améliore le futur du système. Il détecte les patterns, mesure les performances, identifie les dérives, nourrit l’apprentissage stratégique et contribue à l’évolution du capital opératoire. Il ne doit pas être compris comme un simple post mortem passif, mais comme un producteur d’améliorations structurelles futures.
Cette hiérarchie est logique avant d’être technique. Elle ne suppose pas qu’il existe nécessairement un composant, un service ou un agent séparé pour chaque niveau. Plusieurs niveaux peuvent cohabiter dans les mêmes composants à certains stades d’implémentation. En revanche, leurs responsabilités doivent rester distinctes dans le modèle du système.
Elle doit aussi être lue comme une hiérarchie de responsabilité, pas comme une hiérarchie de commande rigide. Un niveau supérieur n’existe pas pour micro gérer le niveau inférieur. Il existe pour encadrer, arbitrer, intensifier, corriger ou suspendre lorsque le niveau inférieur atteint ses limites légitimes.
La hiérarchie est complétée par des plans transverses qui structurent les grandes logiques du système : Policy Plane, Governance Plane, Orchestration Plane, Execution Plane, Control Plane et Learning Plane.
Les niveaux répondent à la question : qui porte quoi.
Les plans répondent à la question : quelle logique traverse le système.
Cette distinction est importante, car certaines fonctions ne doivent pas être réduites à un niveau. Elles traversent plusieurs niveaux et assurent la continuité opératoire de l’ensemble.
Les rôles du système ne doivent pas être compris comme des personnages autonomes figés, mais comme des responsabilités institutionnelles. Ces responsabilités peuvent être incarnées par des agents, des pipelines, des règles, des composants hybrides, des mécanismes collectifs ou des combinaisons de ces mécanismes.
Les fonctions transverses, telles que la supervision, la validation, la mémoire, l’observabilité, la sécurité opératoire et la gestion de l’incertitude, ne constituent pas un sixième niveau hiérarchique. Elles traversent plusieurs niveaux et assurent la continuité, la régulation, la traçabilité et la cohérence du système.
L’intensité réelle d’activation de cette hiérarchie varie selon le mode de mission. La structure des niveaux reste stable, mais la profondeur de contrôle, la fréquence des escalades, le poids de la gouvernance, la densité de validation, la politique de branching ou la présence des comités changent selon que la mission est en mode exploration, delivery, repair, high scrutiny, safe completion ou forensic review.
La hiérarchie doit également produire un responsibility ledger explicite. Toute décision significative, transition importante, promotion d’artefact, replanification, récupération, escalade ou résolution d’intervention doit pouvoir être reliée à un niveau de responsabilité, à un rôle logique et à un mode de contrôle. Cette traçabilité des responsabilités est une condition de l’auditabilité réelle du système.
La finalité de cette architecture n’est pas seulement d’organiser le travail. Elle est de garantir la séparation partielle des pouvoirs, la régulation de l’autonomie, la traçabilité des responsabilités, l’intensité dynamique du contrôle et la production d’une confiance opératoire durable.
Les rôles noyau reconnus dans cette hiérarchie sont les suivants.
Au niveau 1 :
Constitution Manager,
Risk Policy Manager,
Capability Policy Manager.
Au niveau 2 :
Mission Governor,
Arbitration Agent,
Committee Coordinator,
Intervention Interpreter.
Au niveau 3 :
Mission Planner,
Task Router,
Replanning Agent,
Resource Allocator.
Au niveau 4 :
Intent Interpreter,
Domain Advisor,
Solution Architect,
Implementation Agent,
Debug Analyst,
Test Operator,
Documentation Agent,
Research Agent.
Au niveau 5 :
Run Auditor,
Performance Scorer,
Strategy Learner,
Drift Monitor.
Le capital opératoire n’est pas un sixième niveau. Il constitue une dynamique structurante. Il est principalement détecté, évalué et appris par le niveau 5, intégré et mobilisé par le niveau 3, ratifié dans ses formes importantes par le niveau 2, et borné dans ses règles d’admission et d’usage par le niveau 1.

5.	Mécanique générale du système comme gouvernance de trajectoires missionnelles
OpenClaw ne doit pas être pensé comme un simple pipeline de travail, mais comme un système de gouvernance de trajectoires missionnelles. Une mission progresse à travers des phases dominantes, depuis le cadrage initial jusqu’à la clôture et à l’apprentissage, mais cette progression reste traversée par des processus permanents de supervision, de validation, de preuve, de mémoire, de gestion de l’incertitude et de régulation. La mission ne suit pas une séquence rigide. Elle évolue par transitions gouvernées entre objets vivants, sous des régimes de contrôle variables selon le mode de mission, les preuves disponibles, les risques, les interventions, les dégradations de trajectoire et les besoins de convergence.
La mécanique générale du système doit donc être lue comme un cycle missionnel, et non comme un enchaînement strict de runs. Un run constitue une activation opératoire du cycle, mais la mission peut traverser plusieurs runs, plusieurs reprises, plusieurs récupérations ou plusieurs changements de régime sans perdre sa cohérence.
Le cycle missionnel dominant peut être décrit à travers dix phases principales.
Phase 1. Intake and Mission Framing
Le système reçoit l’intention, interprète le besoin, désambiguïse, extrait les contraintes, qualifie le type de mission, le niveau de risque initial et le premier périmètre de travail.
Phase 2. Governance Activation
Le système active le cadre de contrôle applicable : policies, capability scope, blast radius initial, niveau de validation, triggers de comité, mode d’autonomie et mode de mission.
Phase 3. Plan Construction
La mission est traduite en trajectoires opérables. Une Mission Charter devient active, un Case File s’ouvre, des contrats sont qualifiés, des dépendances sont identifiées, des branches potentielles sont reconnues, des artefacts attendus sont définis et des checkpoints sont posés.
Phase 4. Plan Review and Admission
Le plan et les objets initiaux sont relus, admis, ajustés, escaladés ou soumis à comité si nécessaire. Cette phase empêche l’exécution profonde de reposer sur un plan insuffisamment cadré ou insuffisamment gouverné.
Phase 5. Controlled Execution
Les opérateurs spécialisés produisent le travail effectif. Les contrats s’exécutent, les artefacts apparaissent, les workspaces évoluent et les premières preuves se structurent.
Phase 6. Continuous Control Loop
En parallèle de l’exécution, la supervision observe, la validation juge progressivement, la gouvernance peut intensifier, les interventions peuvent être reçues, les signaux faibles sont détectés et les trajectoires sont réévaluées en continu.
Phase 7. Decision and Replanning Junction
Quand une déviation, un conflit, une intervention, un failure ou une opportunité de reconfiguration apparaît, le système décide si l’ajustement doit être local, global, différé, gouverné ou collectif.
Phase 8. Artifact Promotion and Acceptance
Les outputs ne deviennent pas automatiquement des résultats exploitables. Ils sont évalués, promus, gelés, rejetés ou préparés à la livraison selon les preuves disponibles, la gouvernance active et le niveau d’assurance requis.
Phase 9. Delivery / Deployment Decision
Si la mission implique export, publication, remise ou déploiement, cela passe par une promotion gouvernée selon le risque, les preuves, le blast radius, la recovery readiness et la policy active.
Phase 10. Post Mission Audit and Learning
Le système transforme la trajectoire vécue en amélioration future : audit, scoring, patterns, dérives, apprentissage, ajustements stratégiques et enrichissement éventuel du capital opératoire.
Ce cycle missionnel est structuré autour d’une trajectoire de référence. D’autres branches, trajectoires alternatives, récupérations ou explorations peuvent coexister, mais la mission conserve à un instant donné une voie principale de convergence reconnue. Cette trajectoire de référence n’est pas nécessairement figée pour toute la durée de la mission, mais sa requalification doit être gouvernée et traçable.
Le système doit également reconnaître des points de bascule missionnels. Une mission peut changer de régime à la suite d’une intervention humaine, d’un failure significatif, d’une promotion critique, d’une récupération majeure, d’un conflit de preuves ou d’un changement de priorité. Ces moments ne sont pas de simples étapes. Ils constituent des inflection points qui modifient la manière dont la mission doit être gouvernée, validée, ralentie, accélérée, branchée ou clôturée.
La mission ne progresse pas seulement par production. Elle progresse aussi par réduction gouvernée de l’incertitude. À chaque phase, le système cherche à réduire les inconnues pertinentes sur le besoin, la stratégie, la qualité, la sûreté, la readiness d’un artefact, la viabilité d’une branche ou la pertinence d’une récupération.
Plusieurs processus permanents traversent l’ensemble du cycle :
la supervision,
la validation progressive,
l’observabilité,
la mémoire active,
la gestion de l’incertitude,
l’attention routing,
la surveillance du risque,
et la gestion de continuité.
Les interventions humaines ne constituent pas un appendice externe au cycle. Elles modulent la trajectoire missionnelle en cours, soit localement, soit au niveau de la branche, soit au niveau de la gouvernance, selon leur type, leur autorité, leur temporalité et leur impact.
La récupération n’est pas une exception marginale du cycle. Elle constitue l’un des régimes normaux de maintien de trajectoire sous dégradation. De la même manière, la clôture d’une mission n’est pas toujours un succès complet. Elle peut aussi prendre la forme d’une safe partial completion, d’un abort contrôlé, d’une suspension durable, d’une forensic review ou d’un handover humain selon les conditions de fin jugées gouvernables.
Il faut enfin distinguer dans ce cycle :
la progression, qui fait avancer la mission,
la promotion, qui élève le statut ou la portée institutionnelle d’un objet,
et la clôture, qui met fin à une trajectoire ou à la mission elle-même.
6.	Objets fondamentaux du système et capital opératoire
OpenClaw ne doit pas manipuler seulement des prompts, des fichiers ou des tâches vagues. Il doit s’appuyer sur des objets de travail gouvernés, c’est à dire des unités reconnues par le système, porteuses d’état, de responsabilité, de preuve, de transitions et de continuité. C’est cette objectivation du travail qui rend possible la gouvernance réelle du système.
Le premier objet fondamental est la Mission Charter. Elle porte le mandat haut niveau de la mission. Elle formalise l’intention, le résultat attendu, les contraintes structurantes, le périmètre, le mode de mission, le niveau initial de risque, les règles d’engagement, les obligations de contrôle et les critères généraux de clôture. La Mission Charter n’est pas un simple brief. Elle constitue l’objet de cadrage autoritaire de la mission.
Le deuxième objet fondamental est le Case File. Le Case File est le dossier vivant de la mission. Il agrège le contexte consolidé, l’historique utile, les décisions structurantes, les validations, les preuves, les questions ouvertes, les bascules de régime, les recoveries, les interventions et les résumés de continuité. Il constitue la mémoire vivante et gouvernable de la mission. Il n’est ni un simple log, ni un simple historique conversationnel.
Le troisième groupe d’objets fondamentaux est celui des contrats spécialisés. Le système ne doit pas traiter tout travail comme une tâche indistincte. Il doit mobiliser des objets contractuels gouvernés, adaptés à la nature réelle du travail à effectuer. Ces contrats portent des responsabilités, des conditions d’entrée, des attentes de sortie, des règles de validation, des scopes de capacité, des contraintes de gouvernance et des stratégies de récupération éventuelles.
Cinq grandes familles de contrats sont reconnues.
Execution Contracts
Ils gouvernent la production, la transformation ou la mutation réelle d’artefacts, de workspaces ou d’actions opératoires.
Evaluation Contracts
Ils gouvernent le jugement d’acceptabilité, de qualité, de conformité, de readiness ou de robustesse d’un objet ou d’une transition.
Decision Contracts
Ils gouvernent les choix structurants, arbitrages, sélections inter branches, décisions de promotion, résolutions de conflit ou changements de trajectoire.
Observation Contracts
Ils gouvernent la détection, la surveillance, la collecte de signaux, la supervision ciblée ou la qualification de risques, d’anomalies ou de dérives.
Learning Contracts
Ils gouvernent la relecture, la généralisation, la capitalisation, la mise à jour stratégique, l’évolution de patterns ou l’enrichissement du capital opératoire.
Le terme de Task Contract peut continuer à être utilisé comme terme parapluie ou simplifié lorsque le niveau de précision n’exige pas la distinction complète. Mais conceptuellement, le système doit reconnaître cette pluralité de formes.
Chaque contrat doit être situé dans une trajectoire missionnelle, pouvoir être relié à une branche, à un mode de mission, à un niveau de responsabilité, à un régime de contrôle et à des objets de preuve. Il n’est pas une instruction jetable, mais une unité gouvernable du travail.
Les artefacts forment un autre groupe d’objets fondamentaux. Un artefact est toute sortie structurée produite, modifiée, évaluée, promue, rejetée, gelée ou archivée par le système. Les artefacts doivent être distingués selon leur statut et leur finalité.
Il faut au minimum distinguer :
les artefacts de travail, qui servent au processus de production,
les artefacts de preuve, qui servent à justifier des jugements et des transitions,
les artefacts de livraison, qui servent à la remise, à la publication ou au déploiement,
et les artefacts de continuité, qui servent à la reprise, au résumé et à la cohérence de mission.
Les comités sont également des objets de premier rang. Ils ne doivent pas être traités comme une ambiance de collaboration implicite. Ce sont des structures temporaires ou ciblées de délibération et de décision collective, activées lorsque la décision devient intrinsèquement multidimensionnelle et ne doit pas être réduite à une simple validation isolée.
Les interventions sont elles aussi des objets reconnus. Elles ne sont pas de simples messages live. Elles constituent des événements de modulation gouvernée, adressables à une mission, une branche, un contrat, un artefact, une décision ou un régime de gouvernance.
Les différents records produits par le système doivent également être considérés comme des objets gouvernés. Decision Records, Validation Records, Recovery Records, Committee Records, Resume Records et autres objets similaires ne sont pas de simples traces passives. Ils constituent une partie de la structure explicative et gouvernable du système.
OpenClaw repose aussi sur des workspaces, mais ceux-ci ne doivent pas être réduits à de simples dossiers techniques. Un workspace constitue une unité physique de travail dans laquelle s’exécutent des contrats, apparaissent des artefacts, vivent des branches et se matérialisent certaines trajectoires. Il existe une différence conceptuelle forte entre branche logique et workspace physique. Une branche peut s’incarner dans un workspace distinct, mais elle ne s’y réduit pas.
Au delà des outputs missionnels et des artefacts de travail, OpenClaw doit aussi reconnaître un autre type de fondamental structurant : le capital opératoire.
Le capital opératoire désigne l’ensemble des moyens durables, réutilisables et gouvernés que le système peut mobiliser à travers plusieurs missions, runs, workspaces ou branches pour améliorer sa capacité d’action, de contrôle, de récupération, de supervision ou de structuration de l’information. Il ne s’agit pas de livrables destinés à l’utilisateur final, mais de moyens institutionnalisés qui enrichissent le système lui-même.
Il faut donc distinguer clairement :
les Mission Outputs, qui servent à satisfaire le besoin courant,
les Working Artifacts, qui servent à produire, comparer, prouver ou diagnostiquer dans le cadre de la mission,
et l’Operational Capital, qui sert à améliorer durablement les missions futures.
Le capital opératoire ne se limite pas à des outils techniques. Il peut inclure :
des capacités techniques, comme des scripts, wrappers, connecteurs, MCP ou flows,
des capacités cognitives, comme des patterns de diagnostic ou des grilles d’évaluation,
des capacités de gouvernance, comme des protocoles de validation ou de promotion,
des capacités de supervision, comme des watchers ou détecteurs,
des capacités de récupération, comme des routines de containment ou de rollback,
et des capacités de mémoire et de continuité, comme des schémas de résumé ou de reprise.
Le système ne doit pas institutionnaliser librement tout moyen localement utile. Il doit distinguer l’utilité locale d’un moyen de sa valeur durable. Avant de créer un nouveau moyen durable, il doit d’abord évaluer s’il peut réutiliser, composer ou encapsuler temporairement des capacités déjà existantes. La création durable n’est légitime que lorsqu’un besoin récurrent, transversal, robuste et gouvernable le justifie.
Le passage d’un moyen local à un élément du capital opératoire doit être gouverné. Il suppose au minimum :
une qualification du besoin,
un prototypage local,
une évaluation,
une ratification,
une intégration dans un registre explicite,
puis une réévaluation continue.
Le système doit donc disposer, au moins conceptuellement, d’un Capability Registry. Ce registre n’est pas une simple bibliothèque informe. Il doit permettre de savoir ce qu’est une capacité, à quoi elle sert, dans quels contextes elle s’applique, avec quel niveau de confiance, avec quel coût, avec quelle gouvernance d’usage, avec quelle version, avec quel niveau de risque, avec quel historique et avec quel statut de maintenance.
L’existence d’un capital opératoire implique aussi une discipline de dette interne. Un système qui accumule trop de moyens non réévalués finit par se noyer dans sa propre complexité. Il faut donc reconnaître explicitement les notions de redondance, d’obsolescence, de capability debt, de seuil d’adoption et de politique de retraite.
Le capital opératoire n’est pas un pilier identitaire central de la thèse produit. Il constitue en revanche un fondamental structurant de maturité du système. Sans lui, le produit peut exister. Avec lui, le produit devient durablement plus scalable, plus apprenant et plus robuste dans le temps.

7.	États, transitions et gouvernance de trajectoire
Pour être gouvernable, le système ne doit pas seulement manipuler des objets. Il doit aussi leur reconnaître des états explicites, des transitions admissibles et des régimes de contrôle lisibles. Sans cela, la mission devient opaque, la reprise devient fragile, la validation devient arbitraire et la plateforme ne sait plus distinguer ce qui est actif, bloqué, contesté, promu, repris ou clôturé.
Les objets majeurs du système doivent donc disposer d’un cycle de vie explicite. Cela vaut au minimum pour la Mission Charter, le Case File, les contrats, les artefacts, les comités et les interventions. Ces cycles de vie ne servent pas uniquement à décrire l’avancement. Ils servent à gouverner les droits d’action, les obligations de preuve, les possibilités de reprise, la visibilité UX et les formes légitimes de contrôle.
Le système ne doit toutefois pas réduire chaque objet à un seul statut. Un objet peut être actif dans son cycle de vie tout en étant dégradé, contesté, sous review renforcée ou faible en confiance. Il faut donc distinguer plusieurs facettes d’état.
La première facette est le lifecycle state. Elle indique où se situe l’objet dans son parcours institutionnel.
La deuxième facette est le health ou quality state. Elle indique dans quel état qualitatif, de robustesse ou de fraîcheur se trouve l’objet.
La troisième facette est le governance state. Elle indique sous quel régime de contrôle, d’escalade, de review ou de protection l’objet se trouve.
Une quatrième facette peut porter la confiance, c’est à dire le niveau de certitude utile attaché à l’état ou au jugement courant.
Une cinquième facette porte la temporalité : ancienneté, fraîcheur, fenêtre de validité, durée d’attente ou obsolescence potentielle.
Cette approche permet d’éviter un modèle d’état trop pauvre. Un contrat peut par exemple être running, degraded et under_review à la fois. Un artefact peut être validated, mais stale. Une mission peut être active, mais escalated.
Les états ne doivent pas non plus être confondus avec leur projection utilisateur. Le système doit distinguer au moins :
l’état canonique moteur,
l’état utile à la gouvernance,
et la projection UX destinée à Mission Control.
Cette distinction est essentielle. Le moteur a besoin d’une granularité plus fine que l’interface. L’interface a besoin d’une lisibilité plus forte que le moteur. Une même réalité systémique peut donc être projetée différemment selon qu’elle sert la conduite interne du système, la gouvernance, l’audit ou la supervision humaine.
Les états doivent également être normatifs, pas seulement descriptifs. Chaque état important doit impliquer ce qu’il autorise, ce qu’il interdit, ce qu’il exige, ce qu’il doit journaliser et qui peut le faire évoluer. Un état n’a de valeur que s’il change réellement quelque chose dans le fonctionnement du système.
Les états majeurs ne vivent pas isolément. Certaines transitions produisent des effets synchronisés sur d’autres objets. Une décision de comité peut modifier le statut d’un contrat. Une intervention appliquée peut réorienter une branche. Une promotion d’artefact peut changer la phase dominante de la mission. Le système doit donc reconnaître des couplages de transitions entre objets.
Les états doivent aussi être interprétables dans le temps. Un objet under_review depuis quelques secondes et un objet under_review depuis plusieurs heures ne portent pas le même sens. Une intervention queued peut devenir expired. Un résumé de mission peut devenir stale. Une mission paused longtemps peut exiger une reprise sous régime différent. Toute gestion sérieuse de l’état suppose donc des métadonnées temporelles explicites.
Le système doit également distinguer états terminaux, états transitoires, états réversibles et états bloquants. Cette distinction est fondamentale pour la reprise, les recoveries, la clôture et la lisibilité générale de la mission.
Les transitions entre états ne doivent jamais être considérées comme de simples progressions mécaniques. Elles doivent être gouvernées. Un changement d’état significatif est un acte du système, pas une conséquence implicite. Il doit être demandé, évalué, éventuellement ratifié, appliqué et tracé.
C’est pourquoi OpenClaw doit s’appuyer sur un Transition Governance Model. Une transition importante ne doit pas être pensée comme un simple if technique. Elle constitue un acte gouverné de changement institutionnel sur un objet ou une trajectoire.
Une transition commence par une demande de transition. Cette demande peut venir de l’exécution, d’une validation, d’une intervention humaine, d’un recovery, d’un comité, d’un replan ou d’un mécanisme de contrôle interne.
Cette demande est ensuite évaluée selon plusieurs dimensions : preuves disponibles, criticité, mode de mission, blast radius, niveau d’assurance requis, états courants de l’objet, conflits potentiels, obligations pendantes et policy active.
Cette évaluation passe ensuite par une gate, c’est à dire un point de contrôle structuré qui détermine si la transition est admissible. La gate ne doit pas être pensée comme un simple booléen. Elle peut produire plusieurs issues : autorisation, autorisation conditionnelle, report, refus ou escalade.
Certaines transitions peuvent ensuite nécessiter une ratification. Cette ratification peut être automatique, supervisée, gouvernée ou collective selon la nature de la transition. La distinction entre transition demandée, transition évaluée et transition appliquée est fondamentale pour éviter l’opacité.
Une fois appliquée, la transition doit être tracée. Cette trace doit pouvoir alimenter la gouvernance, l’audit, la lisibilité de Mission Control et le responsibility ledger.
Toutes les transitions ne demandent pas le même niveau de contrôle. Certaines sont légères. D’autres sont qualitatives. D’autres encore sont fortement gouvernées car elles touchent à la promotion, au déploiement, à la reprise, aux recoveries ou aux changements de régime. Le système doit donc reconnaître plusieurs intensités de contrôle transitionnel, sans sombrer dans une bureaucratie généralisée.
Les transitions les plus importantes du système doivent être identifiables. Sans figer une liste définitive, il faut reconnaître au moins :
les transitions d’admission de mission,
les transitions d’admission de plan ou de contrat,
les transitions de lancement d’exécution,
les transitions de validation,
les transitions de promotion d’artefact,
les transitions de déploiement,
les transitions de replanification,
les transitions d’escalade,
les transitions de recovery,
et les transitions de clôture.
Ces transitions ne doivent pas être lues uniquement comme des gates d’objet. Certaines d’entre elles agissent sur la trajectoire missionnelle elle même. Un changement de branche de référence, un passage en high scrutiny, une ouverture de recovery, une sortie d’escalade ou une entrée en safe completion sont aussi des transitions de trajectoire.
Il faut donc comprendre que les états et les transitions n’organisent pas seulement des objets. Ils organisent aussi la conduite de la mission dans le temps.
8.	Intervention, preuve, failure, recovery et continuité
La capacité du système à rester gouvernable, explicable et robuste dépend moins de la présence d’un grand nombre de composants que de la qualité de ses mécanismes de régulation sous conditions réelles. C’est pourquoi les interventions, les preuves, les failures, les recoveries et la continuité doivent être considérés comme des dimensions constitutives du système, et non comme des couches secondaires.
Les interventions humaines ne doivent jamais être traitées comme de simples messages entrants injectés dans le moteur. Elles doivent être reconnues comme des objets gouvernés et comme des événements de modulation.
Une intervention n’est donc pas seulement un commentaire. C’est un événement de contrôle adressé à une mission, une branche, un contrat, un artefact, une décision ou un régime de gouvernance. Elle doit être reçue, qualifiée, contextualisée, évaluée en impact, résolue selon policy, puis appliquée, différée, réorientée ou refusée avec traçabilité complète.
Le système doit distinguer plusieurs dimensions d’intervention :
son type,
son scope,
son urgence,
son niveau d’autorité,
son effet attendu,
sa temporalité,
son impact de gouvernance,
et son statut de résolution.
Une intervention peut être consultative, orienter une préférence, porter une instruction locale, demander un override ou chercher à modifier un régime de contrôle. Elle peut produire des effets informationnels, interprétatifs, de contrainte, de priorité, de contrôle, de branching, de promotion ou d’apprentissage. Elle peut être immédiate, liée à un safe point, liée à un checkpoint, persistante ou à durée de validité limitée.
Le système doit donc pouvoir transformer une intervention brute en objet canonisé, lui attribuer une portée claire, détecter ses conflits éventuels avec des interventions précédentes, des policies actives, des artefacts déjà promus ou des décisions déjà ratifiées, puis choisir un mode de résolution adapté. Une intervention importante peut devenir un point de bascule missionnel.
La preuve occupe une place tout aussi centrale. OpenClaw ne doit pas fonder ses décisions sur des intuitions implicites ou sur une simple accumulation de logs. Il doit s’appuyer sur des objets probatoires structurés.
Un Evidence Item est une unité élémentaire de preuve. Il peut s’agir d’un log, d’un diff, d’un résultat de test, d’un score, d’un commentaire humain, d’une sortie de commande, d’une observation de supervision, d’un avis de comité ou d’un signal appris.
Un Evidence Bundle est un ensemble structuré de preuves rassemblées pour soutenir, nuancer ou contester un claim précis. La preuve ne doit donc pas être pensée comme un fichier brut, mais comme une ressource active de gouvernance.
Chaque bundle doit être relié à un claim, c’est à dire à une affirmation opératoire ou décisionnelle du système. Par exemple :
cet artefact est prêt pour promotion,
ce contrat satisfait ses critères d’acceptation,
cette branche doit devenir la trajectoire de référence,
cette récupération est la plus proportionnée,
cette reprise peut être faite sans reframing majeur.
Le système ne doit pas penser la preuve de façon binaire. Il doit reconnaître des preuves de nature différente : factuelles, évaluatives, de gouvernance, de préférence humaine ou d’apprentissage. Il doit également reconnaître des contre preuves, c’est à dire des éléments qui fragilisent ou contestent un claim. La décision ne dépend pas simplement de la présence de preuves, mais d’une suffisance probatoire contextuelle.
Cette suffisance ne doit jamais être uniforme. Elle dépend du niveau d’assurance requis, lui même lié au mode de mission, au blast radius, à l’irréversibilité, à la criticité et aux politiques actives.
La provenance des preuves est également essentielle. Le système doit savoir d’où elles viennent, comment elles ont été obtenues, dans quel contexte, avec quel degré de transformation, et avec quelle fraîcheur. Une preuve ancienne, superseded ou peu fiable ne peut pas être traitée comme une preuve fraîche et forte.
Les bundles doivent pouvoir être actifs, contestés, superseded ou archivés. Ils doivent pouvoir être représentés sous forme brute, sous forme curée et sous forme synthétique, selon qu’ils servent le moteur, l’audit ou Mission Control. Enfin, ils doivent pouvoir s’inscrire dans une evidence chain ou un evidence graph permettant de relier les preuves, les claims, les décisions, les transitions et les apprentissages dans le temps.
L’échec, dans OpenClaw, ne doit pas être réduit à un bug technique. Le système a besoin d’une grammaire plus riche des défaillances. C’est le rôle de la Failure Taxonomy.
Un failure event est une déviation négative suffisamment significative pour empêcher, dégrader, invalider, retarder ou rendre douteuse l’exécution, la validation, la promotion, la gouvernance ou la continuité d’une mission ou d’un objet. Cette défaillance doit être qualifiée selon sa nature, sa cause, sa portée, sa sévérité, sa réversibilité et son mode de détection.
Le système doit reconnaître au moins les grandes familles suivantes :
technical failures,
validation failures,
alignment failures,
planning failures,
governance failures,
capability failures,
dependency or external failures,
convergence failures,
policy or risk failures,
coordination failures.
Il doit aussi distinguer le symptôme visible, la cause directe et la cause racine. Il doit qualifier si l’échec est local, de branche, d’artefact, de contrat, de mission ou systémique. Il doit reconnaître si l’échec est mineur, modéré, majeur ou critique, et s’il est réversible, difficilement réversible ou potentiellement irréversible si appliqué.
Enfin, il doit relier chaque type d’échec à des familles de réponse privilégiées. Une taxonomie d’échec n’est utile que si elle oriente la suite.
La récupération constitue alors l’une des disciplines majeures du système. OpenClaw ne doit pas seulement corriger après coup. Il doit savoir préserver la trajectoire d’une mission sous dégradation.
Le Recovery Model ne doit donc pas être vu comme une simple réponse à l’échec, mais comme une discipline de préservation de trajectoire. Son but n’est pas toujours de revenir exactement à l’état antérieur. Son but est de préserver ce qui a le plus de valeur : la mission, l’intégrité, les artefacts, la preuve, la sûreté, la confiance ou un livrable partiel acceptable.
Le système doit pouvoir distinguer plusieurs grandes familles de récupération.
Les recoveries restauratifs cherchent à restaurer une trajectoire prévue. Ils incluent retry, repair et rollback.
Les recoveries adaptatifs acceptent une déviation contrôlée. Ils incluent reroute, replan et safe partial completion.
Les recoveries protecteurs privilégient la sûreté et la contention. Ils incluent freeze, scope reduction, policy tightening ou review renforcée.
Les recoveries terminaux reconnaissent que la meilleure issue est la clôture propre. Ils incluent abort contrôlé et graceful closeout.
Avant toute récupération, le système doit savoir contenir la propagation d’un problème si nécessaire. Le containment n’est pas encore une récupération. C’est l’action qui empêche l’aggravation.
Une récupération doit ensuite être choisie selon :
la nature du failure ou de la dégradation,
la portée,
la réversibilité,
la confiance dans le diagnostic,
le blast radius du problème,
le blast radius propre de la stratégie de récupération,
le coût de récupération,
la valeur restante de la mission,
la policy active,
et le mode de mission.
La récupération n’est donc pas un réflexe mécanique. Elle est un acte de gouvernance de trajectoire. Certaines récupérations peuvent elles mêmes changer le régime de contrôle, réduire l’autonomie locale, renforcer la gouvernance ou transformer la branche de référence.
Le système doit également reconnaître que la réussite d’une récupération ne signifie pas toujours retour à l’état initial. Une récupération réussie est une récupération qui rétablit une trajectoire suffisamment gouvernable, ou qui préserve la meilleure valeur restante sous contraintes.
La continuité, enfin, ne doit pas être réduite à une simple sauvegarde d’état. Le système doit être conçu pour préserver une continuité de sens, de situation, de raisonnement, d’autorité et de travail opérable à travers le temps.
C’est le rôle du Persistence and Resume Model. La persistance doit permettre de conserver, structurer, résumer, réhydrater et reprendre l’état pertinent d’une mission, de ses objets, de ses décisions, de ses preuves et de sa gouvernance, sans relire en permanence tout le brut et sans perdre la profondeur nécessaire à l’audit.
Le système doit distinguer :
une couche d’état canonique,
une couche de dossier vivant,
une couche de preuves et de traces,
et une vue de reprise.
Il doit aussi reconnaître un Minimum Continuity Set, c’est à dire le noyau minimal d’éléments qui doivent survivre à toute interruption normale pour garantir une reprise de qualité.
La reprise ne doit pas être une simple réouverture. Elle constitue un acte gouverné de réhydratation, de vérification de fraîcheur, d’évaluation de pertinence temporelle, de requalification éventuelle et de réactivation sous un régime explicite. Une mission peut ainsi reprendre en hot resume, warm resume, cold resume ou forensic resume.
Le système doit aussi savoir si une mission est réellement prête à être reprise. C’est le sens du Resume Readiness Profile. Une mission techniquement persistée n’est pas nécessairement cognitivement ou gouvernablement prête à repartir.
La continuité suppose également une discipline de compression. La persistance ne doit pas devenir accumulation brute. Elle doit préserver l’autorité, la lisibilité, la preuve et la capacité à agir, tout en limitant l’entropie informationnelle.
En ce sens, les interventions, les preuves, les failures, les recoveries et la continuité ne sont pas des sous systèmes indépendants. Ils forment ensemble la grammaire de robustesse du système. C’est par eux que la mission reste gouvernable dans le temps, sous incertitude, sous dégradation, sous contestation et sous reprise.

9.	Branching, concurrence et trajectoires multiples
OpenClaw ne doit pas être conçu comme un moteur purement séquentiel. Il doit pouvoir explorer, comparer, corriger et réorienter plusieurs trajectoires de travail en parallèle ou quasi parallèlement. Cette capacité n’est toutefois utile que si elle reste gouvernée. La concurrence ne doit pas être un parallélisme brut. Elle doit être une orchestration sélective de trajectoires multiples au service de la qualité, de la réduction d’incertitude et de la robustesse décisionnelle.
Le système doit donc s’appuyer sur un Concurrency and Branching Model explicite. Ce modèle ne sert pas à maximiser le nombre de branches ouvertes, mais à définir ce qui peut coexister, ce qui doit rester exclusif, comment naissent les trajectoires parallèles, comment elles se synchronisent, comment elles se comparent et comment elles se résolvent sans compromettre l’intégrité de la mission.
Tout ne doit pas être concurrent. Certaines opérations se prêtent naturellement au parallélisme, comme la lecture, la recherche d’options, l’analyse de logs, la comparaison de variantes, certains tests indépendants ou certaines évaluations croisées. D’autres opérations doivent rester fortement contrôlées ou exclusives, notamment lorsqu’il s’agit de muter un même artefact critique, de promouvoir un même objet, de changer un régime de gouvernance, d’intégrer certaines interventions humaines ou de déployer.
Une branche ne doit pas être pensée comme une simple copie de travail. Elle doit être comprise comme une hypothèse opératoire gouvernée. Une branche peut exister pour explorer une solution alternative, tester une hypothèse technique, isoler un risque, ouvrir une voie de récupération, intégrer une intervention humaine sans casser la trajectoire principale, comparer deux approches concurrentes ou préparer une promotion forte. Elle possède donc une intention, un périmètre, des droits, une gouvernance et une raison d’exister.
Le système doit aussi distinguer la branche logique du workspace physique. Une trajectoire peut être incarnée dans un workspace distinct, mais elle ne s’y réduit pas. Le branching porte d’abord sur les hypothèses, les droits de mutation, les claims et les régimes de conduite de mission.
La concurrence utile dans OpenClaw doit être lue selon plusieurs dimensions :
la nature de l’opération,
le périmètre affecté,
le degré de coexistence autorisé,
et le mode de résolution requis.
La nature de l’opération permet de distinguer lecture, évaluation, exploration, mutation, promotion et gouvernance.
Le périmètre affecté peut concerner la mission, une branche, un contrat, un artefact, un workspace ou un régime de gouvernance.
Le degré de coexistence autorisé peut être libre, parallèle contrôlé, parallèle isolé, synchronisé ou exclusif.
Le mode de résolution requis peut aller de l’absence de résolution à la review locale, au merge gouverné, à l’arbitrage, au comité ou au rejet.
Les grandes formes de concurrence reconnues par le système doivent au minimum inclure :
le read parallelism,
l’evaluation parallelism,
le branch parallelism,
l’artifact isolated parallelism,
et l’exclusive mutation scope.
Ces scopes restent une façade lisible du modèle, mais ils doivent être compris comme des dérivés des dimensions plus profondes ci dessus.
Le système doit conserver à tout moment une trajectoire de référence, c’est à dire la voie principale de convergence reconnue à un instant donné. L’existence de plusieurs branches ne doit jamais détruire la lisibilité missionnelle. Les branches alternatives peuvent enrichir, contester ou préparer la trajectoire de référence, mais celle-ci doit rester identifiable et traçable.
Une branche n’a de légitimité que si elle possède une valeur informationnelle ou stratégique. Le système ne doit pas ouvrir de branches par sophistication apparente. Une branche doit exister pour réduire une incertitude importante, comparer plusieurs options crédibles, isoler une zone à risque, tester une récupération, protéger la trajectoire principale ou préparer une promotion significative. En l’absence de valeur attendue durable ou de gain de décision plausible, le branching doit être évité.
Le système doit aussi reconnaître des droits de branche différents. Une branche exploratoire n’a pas les mêmes droits qu’une branche de release candidate, qu’une branche de recovery ou qu’une branche protégée à fort risque. Toutes les branches ne doivent donc ni écrire librement, ni promouvoir librement, ni modifier le régime de mission de la même façon.
Le branching doit être soutenu par une discipline de conflit explicite. Les conflits possibles incluent :
les conflits sur artefact,
les conflits sur plan,
les conflits de gouvernance,
les conflits d’interprétation,
les conflits de priorité,
les conflits de preuve,
et les conflits temporels.
Le conflit temporel mérite une place explicite. Deux trajectoires peuvent être individuellement valides mais incompatibles au moment où elles cherchent à se résoudre, à se fusionner ou à influencer la même décision. Cette dimension temporelle est essentielle dans un système à reprises, interventions, recoveries et points de bascule.
Les branches doivent pouvoir être synchronisées selon plusieurs régimes :
travail asynchrone indépendant,
synchronisation sur checkpoint,
synchronisation gouvernée,
synchronisation d’artefacts,
ou synchronisation déclenchée par intervention humaine.
La fusion ne doit pas être pensée comme une simple opération technique. Dans OpenClaw, merge est un événement de résolution de trajectoire. Il peut conduire à :
une adoption complète de branche,
une fusion partielle d’artefacts,
une fusion de preuves,
une fusion de contraintes de gouvernance,
ou une simple extraction de leçons sans fusion opérationnelle.
Certaines branches ne doivent pas être simplement supprimées quand elles ne sont pas retenues. Une branche peut être rejetée, superseded, clôturée après épuisement, ou au contraire considérée comme informationnellement utile bien qu’elle ne devienne pas la trajectoire de référence.
La concurrence doit enfin rester compatible avec la doctrine d’autonomie disciplinée. Le système doit privilégier la parallélisation des hypothèses, des diagnostics et des jugements avant la parallélisation des mutations critiques. Il doit reconnaître qu’un excès de branches, d’évaluations ou de comparaisons peut lui même devenir une pathologie de non convergence. Le Branching Model doit donc rester sous budget implicite de gouvernance, de preuve, de lisibilité et de valeur attendue.
Mission Control doit pouvoir exposer cette logique sans la caricaturer. L’utilisateur doit pouvoir voir la trajectoire de référence, les branches importantes, leur statut, leur rôle, leur maturité, leur mode de gouvernance, leur potentiel de merge ou de rejet, ainsi que les conflits ou comparaisons en cours lorsque cela est pertinent.
En ce sens, la concurrence dans OpenClaw n’est ni un simple gain de vitesse, ni une multiplication de runs parallèles. Elle constitue une discipline de trajectoires multiples gouvernées, au service de la qualité et de la robustesse de mission.
10.	Capital opératoire et évolution gouvernée des capacités
OpenClaw ne doit pas seulement produire des résultats pour les missions qu’il exécute. Il doit aussi pouvoir faire évoluer de manière gouvernée les moyens qu’il mobilise pour mieux réussir les missions futures. Cette capacité d’auto amélioration ne doit cependant pas être réduite à une création libre d’outils. Elle doit être pensée comme une évolution maîtrisée du capital opératoire du système.
Le capital opératoire désigne l’ensemble des moyens durables, réutilisables et gouvernés qu’OpenClaw peut mobiliser à travers plusieurs missions, runs, workspaces ou branches pour améliorer sa capacité d’action, de contrôle, de supervision, de récupération, de structuration de l’information ou de conduite de mission.
Il faut distinguer clairement trois catégories.
Les Mission Outputs sont les résultats destinés à satisfaire le besoin courant de l’utilisateur ou de la mission.
Les Working Artifacts sont les éléments produits ou manipulés pour travailler, comparer, prouver, diagnostiquer, réviser ou préparer au sein de la mission.
L’Operational Capital est l’ensemble des moyens conservés pour améliorer durablement le fonctionnement futur du système au delà d’un contexte local.
Cette distinction est fondamentale. Un moyen créé pour une mission n’a pas automatiquement vocation à rejoindre le capital opératoire. Un script ponctuel, un wrapper local ou une procédure ad hoc peuvent résoudre un besoin présent sans mériter d’être institutionnalisés.
Le capital opératoire ne se limite pas à des outils techniques. Il peut inclure :
des capacités techniques, comme des scripts, wrappers, connecteurs, MCP, flows ou pipelines,
des capacités cognitives, comme des heuristiques, des patterns de diagnostic, des grilles d’évaluation ou des routines d’analyse,
des capacités de gouvernance, comme des protocoles de validation, de promotion ou de délibération,
des capacités de supervision, comme des watchers, détecteurs, alertes structurées ou routines de surveillance,
des capacités de récupération, comme des protocoles de containment, de rollback, de reroute ou de safe completion,
et des capacités de mémoire et de continuité, comme des schémas de résumé, des routines de compression, des structures de reprise ou des modèles de continuité.
Le système ne doit pas maximiser le nombre de moyens dont il dispose. Il doit chercher à maximiser la qualité, la pertinence, la gouvernabilité et la valeur durable de son capital opératoire. L’auto amélioration ne doit donc jamais être conçue comme une prolifération non gouvernée.
Pour chaque lacune opératoire détectée, le système doit d’abord raisonner en sourcing de capacité avant de raisonner en création. Il doit se demander s’il peut :
réutiliser une capacité existante,
composer plusieurs capacités existantes,
encapsuler temporairement une solution locale,
ou seulement ensuite proposer une extension durable.
Cette doctrine de capability sourcing est centrale. Un système mature doit apprendre non seulement à créer, mais aussi à ne pas créer quand cela n’apporte pas assez de valeur.
Lorsqu’un besoin de moyen nouveau apparaît, le passage vers un élément durable du capital opératoire doit suivre une trajectoire gouvernée. Cette trajectoire peut être décrite comme suit :
détection d’une lacune ou d’une opportunité,
qualification du besoin,
choix de sourcing,
prototypage local,
évaluation,
ratification,
institutionnalisation,
monitoring,
dépréciation éventuelle,
retraite éventuelle.
Le prototypage local peut être relativement flexible. L’institutionnalisation durable ne doit jamais l’être. Elle suppose au minimum :
une réutilisabilité plausible,
une portée non trop niche,
une robustesse minimale,
une compréhension claire,
une compatibilité avec la policy et la sécurité,
une absence de redondance inutile,
et une valeur durable supérieure à la complexité ajoutée.
Le capital opératoire doit être géré à travers un Capability Registry, au moins conceptuel. Ce registre ne doit pas être une collection informelle. Il doit permettre de savoir pour chaque capacité :
ce qu’elle est,
à quoi elle sert,
sur quels types de tâches ou missions elle s’applique,
dans quels scopes elle peut être utilisée,
avec quel coût estimé,
avec quel niveau de confiance,
avec quel niveau de risque,
avec quelle version,
avec quel historique d’usage,
avec quel statut de maintenance,
et sous quel régime de gouvernance elle peut être mobilisée.
Une capacité durable ne se réduit pas à son existence. Elle a un cycle de vie. Elle peut être candidate, active, surveillée, contestée, dépréciée, retirée ou archivée. Le système doit donc reconnaître explicitement la possibilité d’obsolescence, de redondance, de dette de capacité, de seuil d’adoption et de politique de retraite.
Le capital opératoire doit également être distingué du capital de connaissance. Un pattern appris, une préférence récurrente ou une mémoire de mission ne sont pas automatiquement des moyens durables. Le système doit distinguer ce qu’il sait de ce qu’il peut réutiliser comme moyen structuré d’action, d’évaluation, de récupération ou de gouvernance.
Ce capital ne constitue pas un pilier identitaire premier de la thèse produit. Il constitue un fondamental structurant de maturité du système. Sans lui, OpenClaw peut fonctionner comme système gouverné. Avec lui, il devient plus apprenant, plus scalable, plus robuste, plus stable dans le temps et plus capable d’améliorer son propre environnement opératoire.
Le niveau 5 joue un rôle majeur dans la détection des lacunes, l’évaluation des patterns utiles et la proposition d’évolution du capital opératoire. Le niveau 3 joue un rôle central dans l’intégration tactique des capacités utiles. Le niveau 2 intervient dans la ratification des institutionnalisations significatives. Le niveau 1 borne les règles d’admission, d’usage et de sécurité de ces capacités.
En ce sens, le capital opératoire est un ajout structurant au système, non un niveau hiérarchique supplémentaire. Il prolonge la logique d’apprentissage en l’ancrant dans des moyens durables, réutilisables et gouvernés.

11.	Mission Control, supervisabilité et surface utilisateur
Mission Control ne doit pas être conçu comme un simple dashboard de monitoring, ni comme une interface de chat ajoutée au dessus d’un moteur. Sa fonction est plus fondamentale. Il constitue la surface de supervision, d’intervention, de compréhension et d’exploitation du système. Il doit donc refléter la logique institutionnelle d’OpenClaw plutôt que la masquer.
La plateforme ne doit pas se contenter d’afficher des sorties. Elle doit rendre le système supervisable de manière utile. Cela signifie que l’utilisateur ne doit pas seulement voir que quelque chose se passe, mais comprendre à quel niveau de responsabilité cela se passe, sur quel objet, dans quel état, avec quelle preuve, sous quel régime de contrôle et avec quelles possibilités d’action.
La supervisabilité utile suppose une hiérarchisation de la visibilité. Tout ne doit pas être montré au même niveau de détail, ni au même moment. Mission Control doit permettre plusieurs niveaux de lecture.
Au niveau missionnel, l’utilisateur doit pouvoir voir l’intention courante, le mode de mission, la trajectoire de référence, les risques actifs, les obligations pendantes, les points de bascule récents, les recoveries en cours, les branches importantes et le statut global de convergence.
Au niveau du plan et des trajectoires, l’utilisateur doit pouvoir voir les branches significatives, les contrats majeurs, les dépendances, les replanifications, les blocs actifs, les objets sous review, les promotions en attente et les conflits de gouvernance ou de preuve.
Au niveau objet, l’utilisateur doit pouvoir voir les artefacts, contrats, interventions, décisions, validations, bundles de preuve, records de recovery ou comités qui justifient les états visibles ou les actions en cours.
Au niveau explicatif, l’utilisateur doit pouvoir comprendre pourquoi une décision a été prise, quel niveau de responsabilité l’a portée, quelles preuves ont soutenu le claim principal, quelles contre preuves ont été considérées, et pourquoi certaines transitions ont été autorisées, conditionnées, différées ou refusées.
La transparence visée ne doit donc pas être brute. Il ne s’agit pas de déverser en continu le raisonnement interne intégral ou une masse de logs inexploitables. Il s’agit de fournir une transparence hiérarchisée, actionnable et contextualisée.
Le système doit pouvoir représenter ses raisonnements à plusieurs niveaux de profondeur.
Un premier niveau doit fournir une rationale synthétique, c’est à dire ce que le système cherche à faire, pourquoi, et avec quels facteurs dominants.
Un deuxième niveau doit fournir une trace structurée, reliant les entrées, les options considérées, les décisions prises, les niveaux de confiance et les objets affectés.
Un troisième niveau doit permettre, en mode approfondi ou audit, d’accéder aux preuves brutes, aux records détaillés, aux comparaisons de branches, aux bundles complets, aux recoveries, aux délibérations ou aux événements significatifs.
Mission Control doit également permettre une intervention humaine ciblée. L’utilisateur ne doit pas être réduit à un rôle de spectateur. Il doit pouvoir commenter une tâche, un contrat, un artefact, une branche, une décision, une récupération ou un changement de mode missionnel. Il doit pouvoir ajouter une contrainte, redéfinir une priorité, demander une variante, geler une trajectoire, exiger une review plus forte, approuver ou refuser certaines promotions lorsque la policy le prévoit, ou demander une explication plus profonde.
Toutefois, cette capacité d’intervention ne doit jamais transformer la plateforme en télécommande brute du moteur. Mission Control ne doit pas court circuiter la doctrine d’autonomie gouvernée. Toute intervention doit être interprétée, canonisée, contextualisée, résolue et tracée selon l’Intervention Resolution Protocol.
La plateforme doit aussi assister la qualité des interventions humaines. L’utilisateur ne doit pas avoir à deviner seul où intervenir ni comment formuler une intervention utile. Le système doit faire remonter les points à fort impact, proposer les cibles pertinentes, rendre visibles les effets probables d’une intervention et signaler si une action envisagée est consultative, bloquante, différée, gouvernée ou susceptible de produire un point de bascule.
Mission Control doit également refléter la hiérarchie de responsabilité du système. Il ne s’agit pas nécessairement d’exposer un organigramme figé, mais de rendre visible la logique de responsabilité active. L’utilisateur doit pouvoir comprendre ce qui relève de la policy, de la gouvernance stratégique, de l’orchestration tactique, de l’exécution spécialisée, de l’audit ou de l’apprentissage. Il doit pouvoir voir quelles décisions sont locales, lesquelles ont été escaladées, lesquelles ont fait l’objet d’un arbitrage, d’un comité, d’une promotion gouvernée ou d’une reprise sous régime spécial.
Le responsibility ledger doit ainsi avoir une projection UX intelligible. Toute décision importante, toute promotion critique, toute replanification majeure, toute récupération structurante et toute résolution d’intervention significative doivent être explicables par rapport à un niveau de responsabilité, un rôle logique et un mode de contrôle.
Mission Control doit aussi permettre une lecture temporelle du système. L’utilisateur doit pouvoir comprendre non seulement l’état courant, mais aussi le chemin récent : quels points de bascule ont eu lieu, quelles recoveries ont été tentées, quelles validations ont été contestées, quelles branches ont été superseded, quels bundles de preuve ont été remplacés, et si la mission est en reprise chaude, en reprise froide, en mode delivery, en mode repair ou en forensic review.
Enfin, Mission Control doit servir de surface de continuité. Lorsqu’une mission reprend, l’utilisateur ne doit pas relire l’historique brut pour comprendre où en est le système. Il doit disposer d’une vue de reprise lisible, orientée supervision, qui expose l’intention active, la trajectoire de référence, les obligations pendantes, les risques ouverts, les objets encore bloqués, les décisions structurantes récentes et la prochaine meilleure action gouvernable.
En ce sens, Mission Control ne constitue pas un ajout cosmétique au moteur. Il est la projection supervisable de la logique du système. Il doit traduire la complexité interne d’OpenClaw en une surface de contrôle lisible, utile et à fort levier, sans sacrifier la richesse du modèle ni la gouvernance sous jacente.
12.	Chantiers ouverts, zones à formaliser et suite de conception
Ce document fixe la constitution conceptuelle du système cible. Il ne prétend pas clore l’ensemble des questions de conception. Certaines dimensions ont été suffisamment stabilisées pour servir de fondation directe. D’autres doivent encore être précisées sous forme de spécifications complémentaires, de choix d’implémentation ou de décisions de roadmap.
Le premier chantier ouvert concerne le mapping concret entre rôles, familles de modèles open source, workers et contraintes d’infrastructure. Le document a stabilisé la logique de responsabilité et la philosophie d’allocation, mais pas encore le mapping final rôle par rôle, modèle par modèle, ni les enveloppes matérielles et opérationnelles exactes de chaque configuration cible.
Le deuxième chantier concerne la politique d’infrastructure au sens opérationnel. La V2 fixe les principes conceptuels de séparation, de gouvernance de capacité, de workspaces, de continuité et de sécurité by design, mais ne décide pas encore complètement entre mono machine, multi VM, conteneurs spécialisés, topologie de daemon, répartition exacte des composants ou stratégie de déploiement locale et auto hébergée.
Le troisième chantier concerne la mémoire physique, le stockage et l’indexation détaillée. Le document a stabilisé les principes de mémoire hiérarchisée, de continuité, de compression gouvernée, de resume readiness et de distinction entre brut, état canonique et vue de reprise. Il reste toutefois à préciser les supports, les formats, les stratégies de persistance concrète, les règles d’indexation, de récupération, de purge et de synthèse.
Le quatrième chantier concerne l’Exposure Model détaillé. La V2 stabilise le principe de projection différenciée entre moteur, gouvernance et Mission Control. Il reste à définir finement quelles métadonnées sont visibles par défaut, lesquelles sont réservées à des vues avancées, lesquelles sont éditables, comment se structure la progressive disclosure, et comment la plateforme doit équilibrer lisibilité et profondeur.
Le cinquième chantier concerne les Mission Budgets, au sens large. La V2 stabilise la doctrine de convergence gouvernée, de valeur marginale du raisonnement, de sobriété du branching et de récupération proportionnée. Il reste à formaliser plus précisément les budgets de réflexion, d’action, de branching, de validation, de gouvernance et de compute selon les types de mission.
Le sixième chantier concerne le Learning Application Model. Le document a clarifié que l’audit et l’apprentissage doivent produire des corrections structurelles et enrichir éventuellement le capital opératoire. Il reste à définir finement comment ces apprentissages modifient les préférences d’orchestration, les priorités de validation, les seuils d’escalade, les patterns de recovery, les stratégies de branching et les règles d’usage du capital opératoire sans créer de dérive incontrôlée.
Le septième chantier concerne la formalisation détaillée de certains records. La V2 reconnaît déjà l’importance des Decision Records, Validation Records, Recovery Records, Committee Records, Resume Records et du responsibility ledger. Il reste à stabiliser leurs champs exacts, leurs liens obligatoires, leurs durées de validité, leurs projections UX et leurs conditions de supersession.
Le huitième chantier concerne la politique de sécurité détaillée. Le document stabilise la doctrine de secure by design et de capacité gouvernée. Il reste à transformer cette doctrine en policies opérationnelles précises, notamment pour les secrets, le réseau, les systèmes externes, les permissions inter workspaces, la gestion des surfaces de risque du capital opératoire, l’isolation des contextes sensibles et la détection de comportements déviants.
Le neuvième chantier concerne le pilotage produit et la roadmap d’implémentation. Ce document définit la cible conceptuelle. Il reste à la transformer en séquences de travail réalistes, en priorités de développement, en lots fonctionnels et en sprints d’architecture, sans perdre la cohérence du système cible au profit de compromis locaux trop rapides.
Le dixième chantier concerne le nom, le packaging et le positionnement final du produit. La V2 a été rédigée en assumant que le système cible dépasse la fork actuelle d’OpenClaw et l’application desktop de setup no code. Le nom final, le périmètre commercial, la surface exacte du produit et les éléments de branding restent à définir à un stade ultérieur. Ce point ne remet pas en cause la valeur du document, car celui-ci porte d’abord sur la constitution du système, et non sur son identité marketing finale.
À ce stade, le rôle de la V2 n’est donc pas de figer chaque détail d’implémentation. Son rôle est de rendre impossible une dérive conceptuelle majeure. Elle doit servir de texte de référence pour juger si une décision future respecte ou affaiblit la logique du système cible.
Les prochaines étapes de conception devraient logiquement consister à dériver de cette V2 plusieurs artefacts complémentaires :
un tableau maître d’orchestration reliant niveaux, objets, contrats, transitions, preuves, gates, recoveries et modes de mission ;
une spécification plus détaillée des objets structurants et de leurs champs minimaux ;
une spécification du Capability Registry et de la politique de capital opératoire ;
une première matrice de mapping entre rôles, familles de modèles et contraintes d’exécution ;
une spécification Mission Control centrée sur la projection UX des responsabilités, des trajectoires, des preuves, des interventions et des reprises ;
et enfin une feuille de route d’implémentation distinguant ce qui peut être construit immédiatement à partir de la base existante et ce qui relève d’une cible de moyen terme.
Ce document doit donc être considéré comme la base de référence à partir de laquelle ces spécifications dérivées pourront être produites, challengées et versionnées.
