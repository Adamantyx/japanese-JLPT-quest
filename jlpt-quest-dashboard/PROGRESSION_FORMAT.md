# Format de progression v3

Le fichier canonique est `Japonais/progression.json`.

## Blocs

- `profile` : niveau, XP du niveau courant, streak et étoiles cumulées.
- `campaign` : objectif N5, chapitre et date de compte à rebours.
- `today` : quête proposée, résultat confirmé, énergie et étoiles du jour.
- `anki`, `obi`, `listening` : état des trois disciplines qui peuvent allumer une lanterne.
- `duolingo` : étincelle gamifiée, limitée à 5 XP par jour et sans étoile.
- `boss` : tentative bimensuelle, score et XP réellement gagnés.
- `week` : étoiles de la semaine et jours confirmés.
- `milestones` : jalons de la campagne.
- `recentLogs` : traces factuelles les plus récentes.

## Événement `quest`

Champs obligatoires :

```json
{
  "date": "2026-07-16",
  "morningQuest": "15 min Anki reviews uniquement.",
  "eveningQuest": "Reprise active Obi 45.",
  "backlog": 310
}
```

Une nouvelle date remet uniquement les compteurs journaliers à zéro. Elle ne donne aucune étoile et aucune XP.

## Événement `result`

Champs possibles après confirmation explicite de Juliann :

```json
{
  "date": "2026-07-16",
  "anki": {
    "minutes": 12,
    "reviewsToday": 18,
    "backlog": 292
  },
  "obi": {
    "minutes": 10,
    "activeRecall": true,
    "currentLesson": 45
  },
  "listening": {
    "minutes": 0
  },
  "duolingo": {
    "done": true,
    "minutes": 3
  },
  "bonus": {
    "earned": false
  },
  "summary": "Anki et Obi confirmés.",
  "energy": "Bonne"
}
```

## Barème calculé

- Anki : 1 étoile à partir de 10 minutes.
- Obi : 1 étoile si `activeRecall` ou `lessonCompleted` est vrai.
- Écoute : 1 étoile à partir de 10 minutes.
- Bonus : 1 étoile, limité à deux jours par semaine.
- Duolingo : 5 XP une fois par jour, aucune étoile et aucune journée sauvée.
- Mini-boss : 25 XP à partir de 4/5, une tentative par demi-mois.
- Une nouvelle étoile ajoute 40 XP.
- Le script est idempotent pour une même journée : relancer le même bilan ne redonne pas d'XP.
