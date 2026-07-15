# Supabase

Le schéma canonique vit dans `schema.sql`.

## Sécurité

- La clé publishable est la seule clé présente dans le frontend.
- Les trois tables ont la Row Level Security activée.
- Un utilisateur authentifié ne peut lire et écrire que ses propres lignes.
- `study_events` est le journal factuel. Les étoiles de `daily_scores` sont calculées, jamais saisies.
- Le bonus est limité à deux jours par semaine dans la vue calculée.

Ne jamais mettre une clé `service_role` dans le dépôt, le navigateur ou une automation partagée.
