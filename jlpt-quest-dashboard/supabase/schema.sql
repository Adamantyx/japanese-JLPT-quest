begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Voyageur',
  target_date date not null default date '2026-12-01',
  rank text not null default 'Voyageur N5',
  level_seed integer not null default 1 check (level_seed >= 1),
  xp_seed integer not null default 0 check (xp_seed >= 0),
  xp_next_seed integer not null default 100 check (xp_next_seed > 0),
  lifetime_stars_seed integer not null default 0 check (lifetime_stars_seed >= 0),
  backlog_seed integer check (backlog_seed >= 0),
  current_lesson_seed integer not null default 1 check (current_lesson_seed between 1 and 82),
  weekly_star_target integer not null default 8 check (weekly_star_target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quest_date date not null,
  morning_quest text,
  evening_quest text,
  bonus_quest text,
  backlog integer check (backlog >= 0),
  source text not null default 'app' check (source in ('app', 'morning_automation', 'evening_automation', 'migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quest_date)
);

create table if not exists public.study_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null,
  category text not null check (category in ('anki', 'obi', 'listening', 'duolingo', 'bonus')),
  minutes integer not null default 0 check (minutes between 0 and 600),
  reviews integer check (reviews between 0 and 5000),
  backlog integer check (backlog between 0 and 10000),
  lesson_number integer check (lesson_number between 1 and 82),
  lesson_title text,
  active_recall boolean not null default false,
  lesson_completed boolean not null default false,
  note text,
  phrase text,
  energy text,
  source text not null default 'app' check (source in ('app', 'morning_automation', 'evening_automation', 'migration')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.study_events
  drop constraint if exists study_events_category_check;
alter table public.study_events
  add constraint study_events_category_check
  check (category in ('anki', 'obi', 'listening', 'duolingo', 'bonus'));

create index if not exists study_events_user_date_idx
  on public.study_events (user_id, occurred_on desc, created_at desc);

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

create index if not exists daily_quests_user_date_idx
  on public.daily_quests (user_id, quest_date desc);

alter table public.profiles enable row level security;
alter table public.daily_quests enable row level security;
alter table public.study_events enable row level security;
alter table public.boss_attempts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "quests_select_own" on public.daily_quests;
create policy "quests_select_own" on public.daily_quests
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "quests_insert_own" on public.daily_quests;
create policy "quests_insert_own" on public.daily_quests
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "quests_update_own" on public.daily_quests;
create policy "quests_update_own" on public.daily_quests
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "events_select_own" on public.study_events;
create policy "events_select_own" on public.study_events
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "events_insert_own" on public.study_events;
create policy "events_insert_own" on public.study_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "events_update_own" on public.study_events;
create policy "events_update_own" on public.study_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "events_delete_own" on public.study_events;
create policy "events_delete_own" on public.study_events
  for delete to authenticated using ((select auth.uid()) = user_id);

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists daily_quests_touch_updated_at on public.daily_quests;
create trigger daily_quests_touch_updated_at
before update on public.daily_quests
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Voyageur'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace view public.daily_scores
with (security_invoker = true)
as
with daily as (
  select
    user_id,
    occurred_on,
    date_trunc('week', occurred_on::timestamp)::date as week_start,
    case when sum(minutes) filter (where category = 'anki') >= 10 then 1 else 0 end as anki_star,
    case when bool_or(active_recall or lesson_completed) filter (where category = 'obi') then 1 else 0 end as obi_star,
    case when sum(minutes) filter (where category = 'listening') >= 10 then 1 else 0 end as listening_star,
    case when count(*) filter (where category = 'bonus') > 0 then 1 else 0 end as bonus_candidate,
    coalesce(sum(minutes), 0)::integer as total_minutes
  from public.study_events
  group by user_id, occurred_on
), ranked as (
  select
    daily.*,
    sum(bonus_candidate) over (
      partition by user_id, week_start
      order by occurred_on
      rows between unbounded preceding and current row
    ) as bonus_position
  from daily
)
select
  user_id,
  occurred_on,
  week_start,
  anki_star,
  obi_star,
  listening_star,
  case when bonus_candidate = 1 and bonus_position <= 2 then 1 else 0 end as bonus_star,
  anki_star + obi_star + listening_star
    + case when bonus_candidate = 1 and bonus_position <= 2 then 1 else 0 end as total_stars,
  total_minutes
from ranked;

revoke all on public.profiles, public.daily_quests, public.study_events, public.boss_attempts from anon;
revoke all on public.daily_scores from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.daily_quests to authenticated;
grant select, insert, update, delete on public.study_events to authenticated;
grant select, insert, update, delete on public.boss_attempts to authenticated;
grant select on public.daily_scores to authenticated;

commit;
