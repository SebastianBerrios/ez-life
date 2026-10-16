-- Conditional LWW in the database, under the caller's existing RLS policies.
-- No new membership grants, no security definer and no writes outside ez_life.
alter table ez_life.profiles add column if not exists onboarding_step integer check (onboarding_step between 0 and 3);
alter table ez_life.profiles add column if not exists onboarding_income_source_id uuid;
alter table ez_life.movements add column if not exists is_adjustment boolean not null default false;
alter table ez_life.movements add column if not exists installment_payment_id uuid;
alter table if exists ez_life.installment_loans add column if not exists distribution_category_id uuid references ez_life.distribution_categories(id);
alter table if exists ez_life.habits add column if not exists icon text;
alter table if exists ez_life.goals add column if not exists description text;
alter table if exists ez_life.tasks add column if not exists description text;
alter table if exists ez_life.tasks add column if not exists schedule_mode text;
alter table if exists ez_life.tasks add column if not exists fixed_days text[];
alter table if exists ez_life.tasks add column if not exists frequency_target integer;
alter table if exists ez_life.tasks add column if not exists recurrence_series_id uuid;
alter table if exists ez_life.tasks add column if not exists recurrence_active boolean;
alter table ez_life.movements add column if not exists recurrence_rule_id uuid;
alter table ez_life.movements add column if not exists recurrence_month text;
create table if not exists ez_life.movement_recurrences (
  like ez_life.movements including defaults including constraints,
  active boolean not null default true,
  day_of_month integer not null check (day_of_month between 1 and 31),
  activated_month text not null check (activated_month ~ '^\d{4}-\d{2}$'),
  primary key (id)
);
alter table ez_life.movement_recurrences enable row level security;
create policy "own recurrence rules" on ez_life.movement_recurrences for all to authenticated
  using ((select auth.uid()) = user_id and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid())))
  with check ((select auth.uid()) = user_id and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid())));
revoke all on ez_life.movement_recurrences from public, anon;
grant select, insert, update on ez_life.movement_recurrences to authenticated;
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
    'habits', 'habit_completions', 'goals', 'tasks', 'installment_loans', 'installment_payments', 'movement_recurrences'
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
revoke all on function ez_life.sync_record(text, jsonb) from public, anon;
grant execute on function ez_life.sync_record(text, jsonb) to authenticated;
