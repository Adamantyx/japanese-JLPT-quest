# JLPT Quest Progression Format

`progression.json` is the single source of truth for the dashboard and the Japanese morning/evening loop.

## Core fields

- `updatedAt`: ISO timestamp of the last write.
- `title`: display title.
- `level`: current account level.
- `xp`: total experience points.
- `xpNext`: XP target for the next level.
- `streakDays`: current streak length.
- `totalStars`: stars earned today or in the current window.

## Daily tracking

- `anki.doneToday`: whether Anki was done.
- `anki.minutes`: minutes spent in Anki.
- `anki.due`: current due cards count.
- `anki.backlog`: backlog behind schedule.
- `obi.doneToday`: whether Obi was done.
- `obi.currentLesson`: current lesson number.
- `obi.lessonTitle`: lesson theme.
- `obi.minutes`: minutes spent on Obi.
- `listening.doneToday`: whether listening was done.
- `listening.title`: listening source.
- `listening.minutes`: minutes spent listening.

## Morning payload

Use this when the morning automation proposes the day:

```json
{
  "morningQuest": "12 à 15 min d'Anki reviews only.",
  "eveningQuest": "5 à 10 min d'Obi 45 si tu as encore de l'élan.",
  "recentLogs": [
    { "label": "Matin", "value": "Quête proposée" }
  ]
}
```

## Evening payload

Use this when the evening automation confirms the actual result:

```json
{
  "totalStars": 6,
  "recentLogs": [
    { "label": "Anki", "value": "12 min, 16 reviews" },
    { "label": "Obi", "value": "10 min, leçon 45" },
    { "label": "Écoute", "value": "0 min" }
  ]
}
```

## Rule

- The automations should never invent a result.
- If the user has not confirmed the action, the payload must stay factual and provisional.
- The JSON should stay compact enough to be versioned in Git without friction.
