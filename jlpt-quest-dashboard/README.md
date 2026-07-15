# JLPT Quest

Dashboard gamifié de Juliann pour le JLPT N5 de décembre 2026.

## Source de vérité

Supabase est la source de vérité des sessions confirmées et des quêtes. `../progression.json` reste un export local lisible par les automations et le mode de secours hors connexion.

L'application permet de créer un compte, puis d'enregistrer directement une session Anki, Obi, écoute, Duolingo ou bonus. Les étoiles sont calculées depuis le journal `study_events`.

## Couche jeu

- Duolingo est une étincelle : `+5 XP` une fois par jour, sans étoile et sans sauver la journée.
- Mimir évolue selon les étoiles cumulées et le décor change avec lui.
- La carte N5 montre uniquement une couverture prouvée, sans inventer un pourcentage de vocabulaire ou de kanji.
- L'expédition hebdomadaire résume étoiles, minutes, reviews et reprises Obi.
- Les sceaux récompensent les jalons réels.
- Un mini-boss N5 de cinq questions apparaît par quinzaine. Une réussite à `4/5` rapporte `25 XP`.

## PWA

Le dashboard est installable depuis le navigateur. Le service worker garde l'interface en cache et les sessions saisies hors ligne sont mises en attente jusqu'au retour du réseau.

## Supabase

- Projet : `https://ocwstlvorpfwwpxdfdvu.supabase.co`
- Schéma versionné : `supabase/schema.sql`
- Configuration frontend : `supabase-config.js`, clé publishable uniquement
- Client navigateur : Supabase JS 2.110.5, version locale pour le mode PWA
- Sécurité : RLS par `auth.uid()` sur toutes les tables

La clé `service_role` ne doit jamais être ajoutée au dépôt ou au frontend.

Le pont des automations utilise `scripts/supabase-sync.mjs`. Son refresh token utilisateur est stocké dans le Trousseau macOS sous `jlpt-quest-supabase-session`, jamais dans un fichier.

## Boucle quotidienne

1. La quête du matin enregistre uniquement le plan du jour avec l'événement `quest`.
2. Le débrief du soir enregistre uniquement les actions explicitement confirmées avec l'événement `result`.
3. Le script calcule les étoiles, l'XP, le niveau, la semaine et le streak.
4. `publish-dashboard.mjs` copie le dashboard et la progression vers le dépôt GitHub dédié puis pousse les changements. GitHub Pages publie automatiquement la branche une fois activé.

## Commandes

```bash
printf '%s' '{"date":"2026-07-16","morningQuest":"15 min Anki reviews.","eveningQuest":"Obi 45, reprise active."}' \
  | node scripts/record-japanese-session.mjs quest

printf '%s' '{"date":"2026-07-16","anki":{"minutes":12,"reviewsToday":18,"backlog":292},"obi":{"minutes":10,"activeRecall":true},"summary":"Anki et Obi confirmés.","energy":"Bonne"}' \
  | node scripts/record-japanese-session.mjs result

printf '%s' '{"date":"2026-07-16","duolingo":{"done":true,"minutes":4},"summary":"Étincelle Duolingo confirmée."}' \
  | node scripts/record-japanese-session.mjs result

node scripts/publish-dashboard.mjs
```

## Aperçu local

Le JSON ne peut pas être lu correctement via `file://`. Lance un serveur local depuis `Japonais/` :

```bash
python3 -m http.server 4173
```

Puis ouvre `http://localhost:4173/`.
