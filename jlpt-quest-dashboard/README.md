# JLPT Quest

Dashboard gamifié de Juliann pour le JLPT N5 de décembre 2026.

## Source unique

`../progression.json` est la seule source éditable. Le fichier présent dans le dépôt GitHub est une copie de déploiement générée par le script de publication.

## Boucle quotidienne

1. La quête du matin enregistre uniquement le plan du jour avec l'événement `quest`.
2. Le débrief du soir enregistre uniquement les actions explicitement confirmées avec l'événement `result`.
3. Le script calcule les étoiles, l'XP, le niveau, la semaine et le streak.
4. `publish-dashboard.mjs` copie le dashboard et la progression vers le dépôt GitHub dédié, pousse les changements, puis redéploie Vercel.

## Commandes

```bash
printf '%s' '{"date":"2026-07-16","morningQuest":"15 min Anki reviews.","eveningQuest":"Obi 45, reprise active."}' \
  | node scripts/record-japanese-session.mjs quest

printf '%s' '{"date":"2026-07-16","anki":{"minutes":12,"reviewsToday":18,"backlog":292},"obi":{"minutes":10,"activeRecall":true},"summary":"Anki et Obi confirmés.","energy":"Bonne"}' \
  | node scripts/record-japanese-session.mjs result

node scripts/publish-dashboard.mjs
```

## Aperçu local

Le JSON ne peut pas être lu correctement via `file://`. Lance un serveur local depuis `Japonais/` :

```bash
python3 -m http.server 4173
```

Puis ouvre `http://localhost:4173/`.
