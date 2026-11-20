-- Spec 013 (balance del mes, onboarding de 6 pasos, recordatorios "Por registrar",
-- checklist y tour guiado).
-- Additive and idempotent migration for the `ez_life` schema of the shared
-- `mvp-lab` project. NOT applied yet: apply only with `supabase db push`, after
-- running mvp-lab-infra/audit/fleet-auth-audit.sql and with explicit user
-- confirmation (fleet rule: never raw SQL / MCP apply_migration).
--
-- What it does
--   1. Adds optional columns to payment_accounts, income_sources,
--      installment_loans and profiles, and widens profiles_onboarding_step_check
--      from 0..3 to 0..6.
--   2. Creates ez_life.reminder_skips (RLS on, owner-only policy requiring an
--      existing ez_life.profiles row, revokes default ALL grants before granting
--      select/insert/update only — soft-delete through `deleted_at`, no hard
--      delete/truncate, no trigger on auth.users, no implicit membership).
--   3. Widens ez_life.notifications type CHECK to admit 'register_due',
--      preserving every existing type verbatim from
--      20261009195513_personal_achievements.sql.
--   4. Redefines ez_life.sync_record copying the latest body from
--      20261016120000_payment_accounts_time_priority.sql verbatim, with ONLY
--      'reminder_skips' added to the table whitelist. sync_record validates
--      column names dynamically against information_schema.columns, so this
--      migration MUST be live before any client pushes the new columns or
--      onboarding_step 4..6.

-- 1. Optional columns & profiles_onboarding_step_check ------------------------
alter table ez_life.payment_accounts add column if not exists credit_limit  bigint   check (credit_limit is null or credit_limit > 0);
alter table ez_life.payment_accounts add column if not exists closing_day   smallint check (closing_day  is null or closing_day  between 1 and 31);
alter table ez_life.payment_accounts add column if not exists payment_day   smallint check (payment_day  is null or payment_day  between 1 and 31);
alter table ez_life.payment_accounts add column if not exists opening_date  timestamptz;

alter table ez_life.income_sources   add column if not exists pay_day        smallint check (pay_day is null or pay_day between 1 and 31);
alter table ez_life.income_sources   add column if not exists received_month text     check (received_month is null or received_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table ez_life.installment_loans add column if not exists payment_day smallint check (payment_day is null or payment_day between 1 and 31);

alter table ez_life.profiles add column if not exists onboarding_version        smallint;
alter table ez_life.profiles add column if not exists balance_since             text check (balance_since is null or balance_since ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table ez_life.profiles add column if not exists checklist_dismissed       boolean;
alter table ez_life.profiles add column if not exists checklist_not_applicable  jsonb;
alter table ez_life.profiles add column if not exists tour_seen                 boolean;

alter table ez_life.profiles drop constraint if exists profiles_onboarding_step_check;
alter table ez_life.profiles add constraint profiles_onboarding_step_check check (onboarding_step between 0 and 6);

-- 2. reminder_skips -----------------------------------------------------------
create table if not exists ez_life.reminder_skips (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_key   text not null check (char_length(btrim(item_key)) > 0),
  month      text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists reminder_skips_user_month_idx on ez_life.reminder_skips (user_id, month);

alter table ez_life.reminder_skips enable row level security;

drop policy if exists "own rows only" on ez_life.reminder_skips;
create policy "own rows only" on ez_life.reminder_skips
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

-- Default privileges of ez_life grant ALL to anon/authenticated (see 20261017120000): revoke first.
revoke all on ez_life.reminder_skips from public, anon, authenticated;
grant select, insert, update on ez_life.reminder_skips to authenticated;

-- 3. notifications.type -------------------------------------------------------
alter table ez_life.notifications drop constraint if exists notifications_type_check;
alter table ez_life.notifications add constraint notifications_type_check check (type in (
  'budget_over_80','goal_completed','daily_reminder','loan_due_soon','shared_movement_added','habit_reminder','streak_at_risk','task_due','achievement_unlocked','register_due'
));

-- 4. sync_record: latest definition + 'reminder_skips' in the whitelist -------
create or replace function ez_life.sync_record(table_name text, payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  columns_sql text;
  values_sql text;
  updates_sql text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if table_name <> all(array[
    'profiles', 'income_sources', 'distribution_categories', 'expense_categories',
    'expense_subcategories', 'savings_goals', 'movements', 'notifications', 'debts',
    'habits', 'habit_completions', 'goals', 'tasks', 'installment_loans', 'installment_payments', 'movement_recurrences', 'achievement_receipts',
    'payment_accounts', 'reminder_skips'
  ]) then raise exception 'Unsupported sync table'; end if;
  if payload->>'id' is null or payload->>'updated_at' is null then
    raise exception 'Missing identity or version';
  end if;
  if exists (
    select 1 from jsonb_object_keys(payload) k
    where not exists (select 1 from information_schema.columns c
      where c.table_schema = 'ez_life' and c.table_name = sync_record.table_name and c.column_name = k)
  ) then raise exception 'Unknown sync field'; end if;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ' order by c.ordinal_position)
    into columns_sql, values_sql, updates_sql
    from information_schema.columns c
    where c.table_schema = 'ez_life' and c.table_name = sync_record.table_name
      and payload ? c.column_name and c.column_name <> 'id';
  if table_name = 'profiles' then
    -- Profiles are created solely by enroll_self; never insert from sync.
    select string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ')
      into updates_sql from information_schema.columns c
      where c.table_schema = 'ez_life' and c.table_name = 'profiles'
        and payload ? c.column_name and c.column_name <> 'id';
    execute format('update ez_life.profiles t set %s from jsonb_populate_record(null::ez_life.profiles, $1) r
      where t.id = r.id and ((t.deleted_at is null and r.deleted_at is not null)
        or (t.updated_at < r.updated_at and (t.deleted_at is null or r.deleted_at is not null)))', updates_sql)
      using payload;
  else
    execute format('insert into ez_life.%1$I as t (id, %2$s)
      select r.id, %3$s from jsonb_populate_record(null::ez_life.%1$I, $1) r
      on conflict (id) do update set %4$s
      where (t.deleted_at is null and excluded.deleted_at is not null)
         or (t.updated_at < excluded.updated_at and (t.deleted_at is null or excluded.deleted_at is not null))',
      table_name, columns_sql, values_sql, updates_sql) using payload;
  end if;
end $$;
