-- ============================================================================
-- ez_life — feature 001-family-finance-habits, User Story 5.
-- Goals and Tasks are single-user data, same ownership shape as debts/habits.
-- Goal stays fully separate from savings_goals (Principio XIII) — no shared
-- table, no shared columns beyond the family resemblance in shape.
-- ============================================================================

create table ez_life.goals (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  kind           text not null check (kind in ('numeric', 'checklist')),
  target_value   integer, -- required iff kind = 'numeric'
  current_value  integer,
  milestones     jsonb, -- required iff kind = 'checklist': [{ "id": uuid, "label": text, "done": bool }, ...]
  status         text not null default 'active' check (status in ('active', 'completed')),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint goals_shape check (
    (kind = 'numeric' and target_value is not null)
    or
    (kind = 'checklist' and milestones is not null)
  )
);

create table ez_life.tasks (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  due_date   date not null,
  status     text not null default 'pending' check (status in ('pending', 'done')),
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table ez_life.goals enable row level security;
alter table ez_life.tasks enable row level security;

create policy "own rows only" on ez_life.goals
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

create policy "own rows only" on ez_life.tasks
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

grant all on ez_life.goals, ez_life.tasks to anon, authenticated, service_role;

-- One more notification type for task reminders (FR-022).
alter table ez_life.notifications drop constraint notifications_type_check;
alter table ez_life.notifications add constraint notifications_type_check
  check (type in (
    'budget_over_80', 'goal_completed', 'daily_reminder', 'loan_due_soon',
    'shared_movement_added', 'habit_reminder', 'streak_at_risk', 'task_due'
  ));
