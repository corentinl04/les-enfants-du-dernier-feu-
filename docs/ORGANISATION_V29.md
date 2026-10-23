# Organisation multi-agents — cycle v29

Statut : **proposition**, non appliquée. Aucune modification du jeu n'est engagée pour la v29.
Rédigée le 2026-10-23 par la session d'audit et de QA. Les décisions marquées « À VALIDER » attendent Corentin.

## 0. Versions et sources (rappel)

| Nom | Contenu | Statut |
|---|---|---|
| v28 en cours | `game/` sur le PC de Corentin (session « Master Document ») + artifact 7aWs1YwpYcW6YmsgtgSRE2 | En développement, ni figée ni stable |
| Archives | `archives/artefact/` (versions 8a67 et ddea), en lecture seule | Archives de sécurité, intouchables |
| Instantanés de test | `instantanes/` (ex. 991a) | Copies datées de la v28 publiée, servant uniquement aux tests |
| v28 stable | — | N'existe pas : elle sera déclarée après la porte de contrôle de la vague 0 |

Périmètre v29 retenu : `game/directives/V29_chatgpt.md` (décision du 23/10/2026, lue dans l'historique de la session Master, pas dans le fichier lui-même). Il comprend :
- la refonte de la Forêt des Racines ;
- un donjon avec embranchements, secret et raccourci ;
- deux ennemis dessinés (un de mêlée, un à distance) ;
- la refonte de la Mère-Racine ;
- des sons différenciés et des musiques ;
- une évolution persistante du sanctuaire ;
- un parcours complet qui survit à la sauvegarde ;
- la préservation des acquis de la v28.

## 1. Principes

1. **Un seul intégrateur.** Il est le seul à fusionner dans `dev` et `main`, et le seul à publier.
2. **Un fichier, un propriétaire** pendant une tâche. Les fichiers communs (section 4) ne sont modifiés que par l'intégrateur.
3. **Chaque tâche a son propre travail isolé.** Une branche `v29/<id>-<nom>` et, quand c'est possible, un worktree séparé. Aucun agent ne travaille directement sur `dev`.
4. **Aucun agent ne valide son propre travail.** Le circuit est le suivant : tests automatisés → contrôle qualité → audit indépendant → intégration → jeu par Corentin.
5. **Niveaux de preuve**, repris de la convention de la session Master :
   - [T] code lu ;
   - [A] test automatisé exécuté ;
   - [V] rendu inspecté en capture ;
   - [J] parcours joué par Corentin.

   Une tâche n'est « terminée » qu'avec les niveaux exigés par ses critères.
6. **Traçabilité.** Le message de chaque commit commence par l'identifiant de la tâche (`V29-03: …`).
7. **Budget de tentatives : 3 par tâche.** Au-delà, l'agent remonte le problème à l'intégrateur avec un défaut reproductible (étapes, état de départ, résultat obtenu, résultat attendu).

## 2. Contrainte technique préalable

Aujourd'hui, tout le jeu tient dans un seul fichier (`game/index.html`, 18 modules concaténés). **Plusieurs agents qui modifieraient ce fichier en parallèle s'écraseraient.** Il faut donc réaliser la vague 0 avant tout travail parallèle.

## 3. Vague 0 : préalables (intégrateur seul, aucun parallélisme)

| Id | Tâche | Critères d'acceptation |
|---|---|---|
| V29-00a | Figer la v28 candidate et déposer `game/` complet dans le dépôt GitHub privé (branche `v28-candidate`) | Manifeste SHA-256 identique entre le PC et le dépôt [A] |
| V29-00b | Porte de contrôle v28 : suite `tests/v28.mjs` + session de jeu de Corentin | T1 à T7 réussis [A] ; captures des poses examinées [V] ; accord de Corentin [J] → étiquette `v28-stable` |
| V29-00c | Découper le fichier en `src/` (un fichier par module) + script `build` qui reconcatène | Le HTML assemblé est **identique à l'octet** à `v28-stable` [A] |
| V29-00d | Sortir les images base64 dans `assets/` et les réintégrer à l'assemblage | Rendu identique (comparaison d'images sur les scènes de T1) [A] |
| V29-00e | Isoler le code de la Mère-Racine : installation de l'arène de `11_dungeon` (cas `boss` / `racine`) déplacée vers `10_bosses` (`BOSS_AI.racine.arene()`) | Même comportement : T4-racine réussi, aucune autre différence [A] |
| V29-00f | Écrire les contrats d'interface (section 5) | Relus par l'auditeur |

## 4. Propriété des fichiers pendant la v29

| Fichier ou dossier | Propriétaire | Remarque |
|---|---|---|
| `src/05_data.js`, `src/06_save.js`, `src/17_main.js`, `build` | **Intégrateur** | Tables communes, format de sauvegarde, `window.EDF`. Les agents y demandent des ajouts, ils ne les écrivent pas |
| `src/09_enemies.js` + sprites d'ennemis | Combat A | |
| `src/10_bosses.js` (partie Mère-Racine) | Combat B | Les autres boss restent intouchables |
| `src/11_dungeon.js`, `src/02_art_world.js` (forêt) | Région-donjon | |
| `src/03_audio.js` | Audio | Sons synthétisés (oscillateurs, aucun fichier audio aujourd'hui [T]) |
| `src/12_sanctuary.js` | Sanctuaire | Tout changement de format de sauvegarde passe par l'intégrateur |
| `assets/v29/**` | Art | Planches Gemini + métadonnées (point de prise, angles), aucun code |
| `tests/**` | Contrôle qualité | |
| Tous les fichiers | Auditeur | Lecture seule |

## 5. Contrats d'interface (à figer en V29-00f)

- **Ennemi** : une entrée dans `ENNEMIS` (fournie par l'intégrateur) + une fonction de comportement dans `09_enemies`. Pas de projectile géométrique dans le rendu final.
- **Boss** : `BOSS_AI.<id>` = `{ phases, arene(), tick(e, dt), … }`. Les dégâts ne s'appliquent que là où l'attaque est dessinée.
- **Sons** : les identifiants appelés par `Sfx.play('<id>')` sont listés dans un tableau du contrat. Les agents combat et région appellent ces identifiants ; seul l'agent audio les implémente.
- **Sanctuaire** : l'évolution persistante est stockée dans **un seul champ nouveau** de l'état de sauvegarde. Il est ajouté par l'intégrateur, avec une valeur par défaut pour les anciennes sauvegardes, sans nouvelle version du format sauf nécessité démontrée.
- **Art** : chaque planche est livrée en PNG avec un JSON (points de prise, angles, ancrage au sol), au format déjà utilisé par `POSES_ATTAQUE`.

## 6. Rôles et effectif

Effectif initial : **5 rôles actifs + l'art en local.** L'audio et le sanctuaire arrivent en deuxième vague.

| Rôle | Où il tourne | Mission | Limites |
|---|---|---|---|
| **Intégrateur (responsable unique)** — À VALIDER : la session Master | PC (Chrome, Gemini, relais ChatGPT, publication) | Vague 0, fusions, fichiers communs, publication, arbitrages | Ne développe pas les tâches des spécialistes pendant qu'elles sont en cours |
| Combat A (ennemis) | Session cloud ou sous-agent dans sa copie de travail | V29-01, V29-02 | Uniquement `09_enemies` et ses sprites |
| Combat B (Mère-Racine) | Idem | V29-03 | Uniquement `BOSS_AI.racine` et ses sprites |
| Région-donjon | Idem | V29-04 ; intègre les décors de V29-05 | `11_dungeon`, forêt dans `02_art_world` |
| Art | **PC uniquement** (Gemini passe par Chrome) | V29-05, sprites demandés par Combat A/B | Aucun code |
| Contrôle qualité (cette session) | Cloud | Tests de chaque tâche, V29-08 | `tests/` uniquement |
| Auditeur indépendant | Sous-agent sans contexte préalable | V29-09 + avis sur chaque fusion | Lecture seule |
| Audio (vague 2) | Cloud | V29-06 | `03_audio` |
| Sanctuaire (vague 2) | Cloud | V29-07 | `12_sanctuary` |

**Augmenter l'équipe** seulement si une tâche attend un agent depuis plus d'un cycle et si ses fichiers sont libres. Ne jamais donner le même fichier à deux agents.

## 7. Tâches v29 (vague 1 en parallèle, après la vague 0)

| Id | Tâche | Propriétaire | Dépend de | Critères d'acceptation |
|---|---|---|---|---|
| V29-01 | Ennemi de mêlée de la forêt, attaques dessinées | Combat A | 00c, sprites (Art) | Attaque annoncée puis frappe dans la zone dessinée [A] ; 0 erreur sur 60 s de combat simulé [A] ; captures de chaque phase [V] |
| V29-02 | Ennemi à distance, projectiles dessinés | Combat A (après 01) | 01 | Projectile touche ⇔ chevauchement avec son sprite [A] ; aucune forme géométrique [V] |
| V29-03 | Refonte de la Mère-Racine (racines qui sortent du sol, portée réelle, phases) | Combat B | 00e, sprites | Joueur juste hors de la racine visible : 0 dégât ; dedans : dégâts [A] ; ensemble d'attaques différent à chaque phase [A] ; T4 (9 boss) toujours réussi [A] ; captures [V] |
| V29-04 | Donjon de la forêt : embranchements, ≥ 1 secret, 1 raccourci utile, rencontres variées | Région-donjon | 00c | Sur 50 graines : chaque donjon a ≥ 2 embranchements, ≥ 1 secret atteignable, 1 raccourci qui réduit le chemin [A] |
| V29-05 | Décors de la forêt (refonte visuelle, pas une palette) | Art → Région-donjon | 00d | Planches + JSON livrés ; captures avant/après des 5 types de salle [V] ; perf T6 ≤ seuil [A] |
| V29-06 | Sons : épée, frappe lourde, attaques ennemies, racines, impacts du boss ; musique forêt et combat | Audio | contrat des identifiants | Chaque identifiant du contrat produit un son distinct (empreinte du signal) [A] ; écoute par Corentin [J] |
| V29-07 | Évolution persistante du sanctuaire après victoire | Sanctuaire | champ ajouté par l'intégrateur | Visible après victoire, présente après sauvegarde, rechargement et import de code [A] ; anciennes sauvegardes intactes (T5) [A] |
| V29-08 | Parcours complet sanctuaire → forêt → donjon → Mère-Racine → récompense → retour | Contrôle qualité | 01 à 07 intégrés | Parcours automatisé sans intervention [A], puis joué par Corentin [J] |
| V29-09 | Audit de la v29 candidate | Auditeur | 08 | Rapport : régressions, risques, écarts avec la directive v29 |

## 8. Circuit d'une tâche et intégration

1. L'intégrateur ouvre la tâche : identifiant, propriétaire, fichiers autorisés, critères, budget.
2. Le propriétaire développe sur sa branche et fournit le diff, les preuves ([A] et [V]) et la liste des fichiers modifiés.
3. Contrôle qualité : la suite complète + les tests de la tâche, sur la branche.
4. L'auditeur accepte ou refuse, avec motifs.
5. L'intégrateur fusionne dans `dev`, relance la suite complète et publie sur un **artifact d'aperçu séparé** (jamais l'URL officielle).
6. En fin de cycle : porte de contrôle complète (comme V29-00b). Si elle est franchie, fusion dans `main`, étiquette `v29-stable` et publication sur l'URL officielle.
7. **Retour arrière** : republier le HTML assemblé depuis l'étiquette stable précédente, sur la même URL, pour conserver les sauvegardes des joueurs.

## 9. Règles de protection

- Ne jamais toucher `archives/`.
- Ne jamais publier sur l'URL officielle hors porte de contrôle.
- Ne jamais forcer un `push`.
- Le format de sauvegarde ne change que par l'intégrateur, avec un test de compatibilité T5.
- Une session qui reprend un travail relit d'abord `CONTINUITE.md` et l'état du dépôt, et ne s'appuie pas sur sa mémoire.
