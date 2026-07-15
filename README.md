# JLPT Quest Dashboard

Dashboard statique pour suivre la progression N5 de Juliann.

## Source de vérité

- `../progression.json`

## Pages

- `index.html` : interface visuelle responsive.

## But

- Centraliser la progression journalière.
- Afficher XP, niveau, streak, backlog Anki et avancement Obi.
- Servir de base à un futur déploiement GitHub Pages.
- Permettre aux automatisations du matin et du soir de mettre à jour le même fichier.

## Mise à jour

- Script : `scripts/update-progression.mjs`
- Usage : `node scripts/update-progression.mjs < payload.json`
- Le script fusionne le JSON reçu dans `../progression.json`.

## Notes d'intégration

- Les automations du matin et du soir devront écrire dans `../progression.json`.
- Le site lit le JSON en local de repo et peut être publié tel quel sur un hébergement statique.
