# Provenance des archives

Copies exactes, octet pour octet, de l'artifact Claude « Les Enfants du Dernier Feu (Copy) »
(https://claude.ai/artifact/7aWs1YwpYcW6YmsgtgSRE2), telles que renvoyées par le service d'artifacts
(page servie, enveloppe HTML de la plateforme comprise).

| Fichier | Version de l'artifact | Récupérée le | Octets | SHA-256 |
|---|---|---|---|---|
| artifact-3544c795-1792760227-8a67.html | 1792760227-8a67 | 2026-10-23 | 1 943 373 | 2f7526ba73db88113711edf01a18a97b75bc1f0995a9453dd1cfa049f76322ff |
| artifact-3544c795-1792772245-ddea.html | 1792772245-ddea | 2026-10-23 | 1 997 359 | a067c6bf6ae12828d8616b080130d08d772c654435f2b7e7a0ebd87e3df3cb1a |

Contrôle : `sha256sum -c archives/artefact/SHA256SUMS` (depuis `archives/artefact/`).

## Statut

- **Base de travail provisoire.** Ce n'est PAS une référence définitive : l'artifact est une copie (« Copy ») et la
  version stable originale n'a pas été retrouvée. Toute différence avec une éventuelle version originale reste
  **non vérifiée**.
- La version 1792772245-ddea a été publiée pendant la session d'audit (entre deux lectures). Elle ajoute un
  marquage « v28 » (poses d'attaque, compteurs économiques) dans 8 modules et cite un dossier `art/v28_animation`
  absent de cet environnement : un autre environnement de travail existe probablement. Non vérifié.

## Vérification de fonctionnement (2026-10-23, Chromium headless via Playwright 1.63)

Script : `tools/verifier-archive.mjs`. Résultats : `archives/verifications/<version>/rapport.json`.
Les deux versions : écran titre, nouvelle partie, sanctuaire, expédition dans les 5 régions (commandes simulées),
sauvegarde puis rechargement, export/import du code de transfert — 0 erreur JavaScript.
Limites : test automatisé court ; ni combat de boss, ni rendu sur mobile, ni session de jeu humaine.
