-- ============================================================================
-- ez_life — feature 001-family-finance-habits, User Story 4.
-- Habits are single-user data, same ownership shape as debts — a plain
-- "own rows only" RLS policy is enough, no RPC needed.
-- ============================================================================

create table ez_life.habits (
  id                uuid primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  schedule_mode     text not null check (schedule_mode in ('fixed_days', 'frequency')),
  fixed_days        text[], -- e.g. {'mon','wed','fri'}; required iff schedule_mode = 'fixed_days'
  frequency_target  integer check (frequency_target is null or frequency_target >= 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint habits_schedule_shape check (
    (schedule_mode = 'fixed_days' and fixed_days is not null and array_length(fixed_days, 1) >= 1)
    or
    (schedule_mode = 'frequency' and frequency_target is not null)
  )
);

create table ez_life.habit_completions (
  id          uuid primary key,
  habit_id    uuid not null references ez_life.habits(id) on delete cascade,
  date        date not null,
  token_used  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

alter table ez_life.habits enable row level security;
alter table ez_life.habit_completions enable row level security;

create policy "own rows only" on ez_life.habits
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

-- No user_id of its own — ownership is derived through its parent habit.
create policy "own rows only" on ez_life.habit_completions
  for all to authenticated
  using (
    exists (select 1 from ez_life.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from ez_life.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

grant all on ez_life.habits, ez_life.habit_completions to anon, authenticated, service_role;
