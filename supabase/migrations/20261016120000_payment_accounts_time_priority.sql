-- Spec 011 (cuentas de pago, hora del movimiento, prioridad de tareas).
-- Additive and idempotent migration for the `ez_life` schema of the shared
-- `mvp-lab` project. NOT applied yet: apply only with `supabase db push`, after
-- running mvp-lab-infra/audit/fleet-auth-audit.sql and with explicit user
-- confirmation (fleet rule: never raw SQL / MCP apply_migration).
--
-- What it does
--   1. Creates ez_life.payment_accounts (RLS on, owner-only policy, no anon,
--      no hard-delete grant: rows are soft-deleted through `deleted_at`).
--   2. movements + movement_recurrences: adds account_id / to_account_id (both
--      nullable, composite FK to (id, user_id) so an account can only be
--      referenced by its owner), admits type 'TRANSFER' in the type CHECK and
--      adds a shape CHECK (TRANSFER = two different accounts, no category /
--      income source / savings goal / adjustment / recurrence; any other type
--      has no destination account).
--   3. tasks: adds priority ('high'|'medium'|'low', nullable = medium) and tag.
--   4. Redefines ez_life.sync_record with 'payment_accounts' in its table
--      whitelist. The body is the latest definition
--      (20261009195513_personal_achievements.sql) copied verbatim; the ONLY
--      change is the extra whitelist entry. sync_record rejects unknown payload
--      keys, so this migration MUST be live before any client pushes the new
--      fields (account_id, to_account_id, priority, tag) or payment_accounts.
--
-- ez_life.create_shared_movement(...) inserts movements with an explicit column
-- list that does not include the new nullable columns, so it keeps working and
-- shared movements simply stay without an account (type is INCOME/EXPENSE and
-- to_account_id is null, which satisfies the shape CHECK).

-- 1. payment_accounts ---------------------------------------------------------
create table if not exists ez_life.payment_accounts (
  id              uuid primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (char_length(btrim(name)) > 0),
  kind            text not null check (kind in ('debit', 'credit', 'cash', 'savings')),
  opening_balance bigint not null default 0, -- integer cents, may be negative
  archived        boolean default false,     -- nullable on purpose: clients send null when unset
  sort_order      integer,
  created_at      timestamptz not null,
  updated_at      timestamptz not null,
  deleted_at      timestamptz
);

-- Target of the composite owner FKs below.
alter table ez_life.payment_accounts drop constraint if exists payment_accounts_id_user_id_key;
alter table ez_life.payment_accounts add constraint payment_accounts_id_user_id_key unique (id, user_id);

create index if not exists payment_accounts_user_id_idx on ez_life.payment_accounts (user_id);

alter table ez_life.payment_accounts enable row level security;

drop policy if exists "own rows only" on ez_life.payment_accounts;
create policy "own rows only" on ez_life.payment_accounts
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

revoke all on ez_life.payment_accounts from public, anon;
grant select, insert, update on ez_life.payment_accounts to authenticated;

-- 2. movements + movement_recurrences -----------------------------------------
alter table ez_life.movements add column if not exists account_id uuid;
alter table ez_life.movements add column if not exists to_account_id uuid;
alter table ez_life.movement_recurrences add column if not exists account_id uuid;
alter table ez_life.movement_recurrences add column if not exists to_account_id uuid;

do $$
declare
  t text;
  c record;
begin
  foreach t in array array['movements', 'movement_recurrences']
  loop
    -- Drop the existing `type in ('INCOME','EXPENSE')` CHECK whatever its name
    -- (movement_recurrences was created with LIKE ... INCLUDING CONSTRAINTS).
    for c in
      select conname from pg_constraint
      where conrelid = format('ez_life.%I', t)::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%''INCOME''%'
    loop
      execute format('alter table ez_life.%I drop constraint %I', t, c.conname);
    end loop;

    execute format(
      'alter table ez_life.%I add constraint %I check (type in (''INCOME'', ''EXPENSE'', ''TRANSFER''))',
      t, t || '_type_check');

    execute format('alter table ez_life.%I drop constraint if exists %I', t, t || '_transfer_shape_check');
    execute format(
      'alter table ez_life.%I add constraint %I check (
         (type = ''TRANSFER''
            and account_id is not null and to_account_id is not null
            and account_id <> to_account_id
            and distribution_category_id is null and expense_category_id is null
            and expense_subcategory_id is null and income_source_id is null
            and savings_goal_id is null
            and coalesce(is_adjustment, false) = false
            and coalesce(is_recurring, false) = false)
         or (type <> ''TRANSFER'' and to_account_id is null)
       )', t, t || '_transfer_shape_check');

    -- Composite FKs: a movement can only point to accounts owned by its user.
    execute format('alter table ez_life.%I drop constraint if exists %I', t, t || '_account_owner_fkey');
    execute format(
      'alter table ez_life.%I add constraint %I foreign key (account_id, user_id)
         references ez_life.payment_accounts (id, user_id)', t, t || '_account_owner_fkey');
    execute format('alter table ez_life.%I drop constraint if exists %I', t, t || '_to_account_owner_fkey');
    execute format(
      'alter table ez_life.%I add constraint %I foreign key (to_account_id, user_id)
         references ez_life.payment_accounts (id, user_id)', t, t || '_to_account_owner_fkey');

    execute format('create index if not exists %I on ez_life.%I (account_id)', t || '_account_id_idx', t);
    execute format('create index if not exists %I on ez_life.%I (to_account_id)', t || '_to_account_id_idx', t);
  end loop;
end $$;

-- 3. tasks ---------------------------------------------------------------------
alter table ez_life.tasks add column if not exists priority text check (priority in ('high', 'medium', 'low'));
alter table ez_life.tasks add column if not exists tag text;

-- 4. sync_record: latest definition + 'payment_accounts' in the whitelist -----
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
    'payment_accounts'
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
