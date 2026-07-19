# Déploiement

## Dépôt

- GitHub : `git@github.com:Adamantyx/japanese-JLPT-quest.git`
- Copie locale de déploiement : `Japonais/japanese-JLPT-quest/`
- Branche : `main`

Le dépôt ne contient aucun autre fichier de l'OS perso.

## Publication

```bash
node Japonais/jlpt-quest-dashboard/scripts/publish-dashboard.mjs
```

Le script copie uniquement :

- `Japonais/index.html`
- `Japonais/progression.json`
- `Japonais/anki-history.json`
- l'interface PWA, les assets finaux, la configuration publique Supabase, le schéma, la documentation et les scripts du dashboard

Il crée un commit uniquement en présence de changements puis pousse `main`. GitHub Pages republie alors automatiquement la branche.

## Publication

- URL principale : `https://adamantyx.github.io/japanese-JLPT-quest/jlpt-quest-dashboard/index.html`
- Le dashboard se publie via `publish-dashboard.mjs`, qui pousse sur `main`.
- GitHub Pages sert ensuite la version publique automatiquement.

## GitHub Pages

Dans le dépôt GitHub :

1. Ouvrir `Settings > Pages`.
2. Choisir `Deploy from a branch`.
3. Sélectionner `main` et `/ (root)`.
4. Enregistrer.

L'URL racine est `https://adamantyx.github.io/japanese-JLPT-quest/`.
