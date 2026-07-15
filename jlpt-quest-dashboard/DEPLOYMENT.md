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
- l'interface, les assets finaux, la documentation et les scripts du dashboard

Il crée un commit uniquement en présence de changements, pousse `main`, puis redéploie la production Vercel liée à la copie locale.

## Production active

- URL : `https://japanese-jlpt-quest.vercel.app/`
- Projet Vercel : `japanese-jlpt-quest`
- Le dépôt GitHub privé n'est pas relié automatiquement à Vercel. Le script de publication assure donc le déploiement après chaque mise à jour confirmée.

## GitHub Pages

Dans le dépôt GitHub :

1. Ouvrir `Settings > Pages`.
2. Choisir `Deploy from a branch`.
3. Sélectionner `main` et `/ (root)`.
4. Enregistrer.

L'URL attendue est `https://adamantyx.github.io/japanese-JLPT-quest/`.
