alter table ez_life.profiles add column if not exists gamification_enabled boolean not null default true;
create table ez_life.achievement_receipts (
  id uuid primary key,
  user_id uuid not null references ez_life.profiles(id),
  achievement_id text not null check (achievement_id in ('registration','tasks','goal','consistency','savings_half','savings_full')),
  celebration_handled boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  unique (user_id, achievement_id)
);
alter table ez_life.achievement_receipts enable row level security;
revoke all on ez_life.achievement_receipts from public, anon, authenticated;
grant select, insert, update on ez_life.achievement_receipts to authenticated;
create policy "read own achievements" on ez_life.achievement_receipts for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own achievements" on ez_life.achievement_receipts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own achievements" on ez_life.achievement_receipts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table ez_life.notifications drop constraint notifications_type_check;
alter table ez_life.notifications add constraint notifications_type_check check (type in (
  'budget_over_80','goal_completed','daily_reminder','loan_due_soon','shared_movement_added','habit_reminder','streak_at_risk','task_due','achievement_unlocked'
));
-- Receipt handling is monotonic even across stale device snapshots.
create function ez_life.keep_achievement_history() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.celebration_handled := old.celebration_handled or new.celebration_handled;
  return new;
end;
$$;
create trigger keep_achievement_history before update on ez_life.achievement_receipts for each row execute function ez_life.keep_achievement_history();
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
    'habits', 'habit_completions', 'goals', 'tasks', 'installment_loans', 'installment_payments', 'movement_recurrences', 'achievement_receipts'
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
