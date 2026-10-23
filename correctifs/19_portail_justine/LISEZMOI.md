# Correctif §19 (partiel) — plantage de rendu après la victoire contre Justine

Statut : PROPOSÉ, vérifié sur copie, NON intégré (la session Master est seule à modifier `game\index.html`).

## Cause (reproduite)
`justineVaincue()` ajoute le portail de sortie avec `img: SPR_WORLD.prop.portailJ`. Cette image n'est fabriquée que dans
`setupPortailJustine()` (ancre du Domaine). Si elle n'existe pas, `drawProp` lit `pr.img.width` sur `undefined` à chaque
image ; la boucle principale intercepte l'exception et affiche « Une erreur est survenue. La partie a été sauvegardée… ».

## Portée réelle — à ne pas surestimer
Reproduit en entrant dans l'arène de Justine SANS passer par l'ancre du Domaine (chemin de test). En jeu normal, l'ancre
fabrique l'image avant le combat : ce n'est donc probablement PAS le défaut que Corentin observe. Celui-ci n'a pas été
reproduit pour les 8 autres boss sur le cycle complet (victoire → dialogues → retour au sanctuaire → sauvegarde → rechargement),
avec une partie neuve. Il dépend peut-être de l'état d'une vraie sauvegarde.

## Correctif
Fonction `spritePortailJ()` qui fabrique l'image à la demande, utilisée aux deux endroits (`correctif_portailJ.diff`,
appliqué à `source/index.html`, SHA-256 avant 8eff1025…, après bb47ed96…).

## Vérification
`tests/cycle_boss.mjs <fichier> justine` — avant : 1 toast d'erreur, 1 370 erreurs ; après : 0 toast, 0 erreur ;
victoire comptée une fois ; `bossMajeurs.justine` conservé après rechargement. Commandes simulées.
