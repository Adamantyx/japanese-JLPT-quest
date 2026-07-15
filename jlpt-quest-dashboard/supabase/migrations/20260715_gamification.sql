begin;

alter table public.study_events
  drop constraint if exists study_events_category_check;
alter table public.study_events
  add constraint study_events_category_check
  check (category in ('anki', 'obi', 'listening', 'duolingo', 'bonus'));

create unique index if not exists study_events_one_duolingo_per_day_idx
  on public.study_events (user_id, occurred_on)
  where category = 'duolingo';

create table if not exists public.boss_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_key text not null,
  score integer not null check (score between 0 and 5),
  passed boolean not null,
  answers jsonb not null default '[]'::jsonb,
  xp_awarded integer not null default 0 check (xp_awarded between 0 and 25),
  attempted_at timestamptz not null default now(),
  check ((passed and score >= 4 and xp_awarded = 25) or (not passed and score < 4 and xp_awarded = 0)),
  unique (user_id, cycle_key)
);

alter table public.boss_attempts enable row level security;

drop policy if exists "boss_attempts_select_own" on public.boss_attempts;
create policy "boss_attempts_select_own" on public.boss_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "boss_attempts_insert_own" on public.boss_attempts;
create policy "boss_attempts_insert_own" on public.boss_attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "boss_attempts_update_own" on public.boss_attempts;
create policy "boss_attempts_update_own" on public.boss_attempts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "boss_attempts_delete_own" on public.boss_attempts;
create policy "boss_attempts_delete_own" on public.boss_attempts
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.boss_attempts from anon;
grant select, insert, update, delete on public.boss_attempts to authenticated;

commit;
