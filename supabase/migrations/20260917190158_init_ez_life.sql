-- ============================================================================
-- ez_life — baseline schema (mvp-lab fleet), migration #1.
--
-- ez-life never had a remote schema before this migration (verified by direct
-- read of the mvp-lab project: only ez_finance, oasis, hello_meditacna,
-- fast_route, cv_generator existed). This brings the remote schema up to
-- parity with what the app already models locally in Dexie
-- (src/core/domain/models/types.ts) before adding this feature's own tables
-- in the next migration.
--
-- Adapted from mvp-lab-infra/scaffold/new-app-schema.template.sql. One real
-- deviation from that template, called out explicitly because it touches the
-- fleet's core safety invariant (Principio IX — membership is never implicit
-- from authentication):
--
--   ez-life logs in via OAuth only (supabase.auth.signInWithOAuth, Google/
--   GitHub — see src/presentation/components/LoginScreen.tsx). That call
--   cannot set custom `options.data` the way `signUp()` can (confirmed against
--   the installed @supabase/auth-js type defs — SignInWithOAuthCredentials has
--   no `data` field), so `enroll_self()` cannot gate on a namespaced signup
--   intent in `raw_user_meta_data` the way the generic template does.
--
--   The invariant Principio IX actually requires is "membership is created by
--   an explicit server-side path, never a trigger on auth.users and never a
--   client-side insert" — the metadata gate is ONE way to satisfy that, not
--   the only way. Here, `enroll_self()` is safe because it is only ever
--   invoked by an explicit call the ez-life app UI makes (from its onboarding
--   flow) — never automatically. No trigger on auth.users, no self-insert RLS
--   policy on `profiles` (there is deliberately no INSERT policy on it at
--   all). A fleet user from another app who never runs ez-life's own code
--   never calls this RPC, so they never get a profiles row.
--
-- `profiles` here doubles as both the fleet membership record (its mere
-- existence is what "this auth.users row is an ez-life member" means) and
-- ez-life's own per-user settings row (the `Profile` domain type) — one
-- table, not two, per the project's own simplicity principle.
-- ============================================================================

create schema if not exists ez_life;
create schema if not exists ez_life_private;

insert into public.rls_managed_schemas (schema_name)
values ('ez_life') on conflict do nothing;

-- ── profiles (membership + settings) ────────────────────────────────────────

create table ez_life.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  last_recurrence_eval_month text,
  notification_hour          smallint,
  push_enabled                boolean not null default true,
  inapp_enabled               boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);
alter table ez_life.profiles enable row level security;

create policy "read own profile" on ez_life.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "update own profile" on ez_life.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert policy — deliberately. Membership is minted only by enroll_self().

-- ── domain tables (parity with the existing local Dexie schema) ────────────
-- Every policy below also requires an existing `profiles` row, so an
-- authenticated-but-never-enrolled fleet user hits a dead end on every table,
-- not just on `profiles` itself.

create table ez_life.income_sources (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  amount     integer not null, -- cents
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table ez_life.distribution_categories (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  percentage integer not null check (percentage between 1 and 100),
  is_default boolean not null default false,
  is_savings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table ez_life.expense_categories (
  id                        uuid primary key,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  distribution_category_id uuid not null references ez_life.distribution_categories(id) on delete cascade,
  name                      text not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

-- No user_id of its own — ownership is derived through expense_categories.
create table ez_life.expense_subcategories (
  id          uuid primary key,
  category_id uuid not null references ez_life.expense_categories(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table ez_life.savings_goals (
  id            uuid primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  target_amount integer not null, -- cents
  deadline      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table ez_life.movements (
  id                        uuid primary key,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  type                      text not null check (type in ('INCOME', 'EXPENSE')),
  amount                    integer not null, -- cents
  date                      timestamptz not null,
  description               text,
  distribution_category_id uuid references ez_life.distribution_categories(id) on delete set null,
  expense_category_id      uuid references ez_life.expense_categories(id) on delete set null,
  expense_subcategory_id    uuid references ez_life.expense_subcategories(id) on delete set null,
  income_source_id          uuid references ez_life.income_sources(id) on delete set null,
  savings_goal_id            uuid references ez_life.savings_goals(id) on delete set null,
  is_recurring              boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

create table ez_life.notifications (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('budget_over_80', 'goal_completed', 'daily_reminder', 'loan_due_soon')),
  title      text not null,
  body       text not null,
  read_at    timestamptz,
  related_id text,
  cycle_key  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table ez_life.income_sources           enable row level security;
alter table ez_life.distribution_categories  enable row level security;
alter table ez_life.expense_categories       enable row level security;
alter table ez_life.expense_subcategories    enable row level security;
alter table ez_life.savings_goals            enable row level security;
alter table ez_life.movements                enable row level security;
alter table ez_life.notifications            enable row level security;

-- Standard "own rows, and only if enrolled" policy for every user_id-scoped
-- table above (income_sources, distribution_categories, expense_categories,
-- savings_goals, movements, notifications share this exact shape).
do $$
declare
  t text;
begin
  foreach t in array array[
    'income_sources', 'distribution_categories', 'expense_categories',
    'savings_goals', 'movements', 'notifications'
  ]
  loop
    execute format(
      'create policy "own rows only" on ez_life.%I
         for all to authenticated
         using (
           (select auth.uid()) = user_id
           and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
         )
         with check (
           (select auth.uid()) = user_id
           and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
         );',
      t
    );
  end loop;
end $$;

-- expense_subcategories has no user_id of its own — ownership is derived
-- through its parent expense_category.
create policy "own rows only" on ez_life.expense_subcategories
  for all to authenticated
  using (
    exists (
      select 1 from ez_life.expense_categories ec
      join ez_life.profiles p on p.id = (select auth.uid())
      where ec.id = category_id and ec.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from ez_life.expense_categories ec
      join ez_life.profiles p on p.id = (select auth.uid())
      where ec.id = category_id and ec.user_id = (select auth.uid())
    )
  );

-- ── grants ───────────────────────────────────────────────────────────────

grant usage on schema ez_life to anon, authenticated, service_role;
grant all on all tables    in schema ez_life to anon, authenticated, service_role;
grant all on all routines  in schema ez_life to anon, authenticated, service_role;
grant all on all sequences in schema ez_life to anon, authenticated, service_role;
alter default privileges in schema ez_life grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema ez_life grant all on routines  to anon, authenticated, service_role;
alter default privileges in schema ez_life grant all on sequences to anon, authenticated, service_role;

-- ── explicit enrollment ─────────────────────────────────────────────────────

create or replace function ez_life.enroll_self()
  returns ez_life.profiles language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := auth.uid();
  v_row ez_life.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 1));

  select * into v_row from ez_life.profiles where id = v_uid;
  if found then
    return v_row;
  end if;

  insert into ez_life.profiles (id) values (v_uid) returning * into v_row;
  return v_row;
end $$;

revoke all on function ez_life.enroll_self() from public;
grant execute on function ez_life.enroll_self() to authenticated;

-- ============================================================================
-- AFTER `supabase db push`, expose the schema on the remote (append to the
-- CURRENT list — do not drop any existing entry) and reload PostgREST:
--
--   alter role authenticator set pgrst.db_schemas =
--     'public, graphql_public, fast_route, ez_finance, oasis, cv_generator, ez_life';
--   notify pgrst, 'reload config';
--   notify pgrst, 'reload schema';
--
-- (hello_meditacna is registered in mvp-lab-infra's app list but was not
-- present in the current live pgrst.db_schemas value read on 2026-09-17 —
-- do not add it here; only append ez_life to whatever the live value
-- actually is at push time.)
-- ============================================================================
