-- ============================================================================
-- ez_life — feature 001-family-finance-habits, User Story 3.
-- Shared expenses/income with per-member splits, and the linked personal
-- Movement each member gets from one (FR-011, FR-012).
--
-- create_shared_movement() is an RPC, not a direct client insert, because it
-- writes a Movement row for OTHER members too (their linked share) — a plain
-- "own rows only" RLS policy can never allow that. Splits are computed
-- client-side (core/use-cases/createSharedMovement.ts, Principio III) and
-- passed in pre-computed; the RPC re-validates the sum and that every target
-- is an active member, as defense in depth, then persists everything
-- atomically.
-- ============================================================================

create table ez_life.shared_movements (
  id                  uuid primary key,
  shared_space_id     uuid not null references ez_life.shared_spaces(id) on delete cascade,
  created_by          uuid not null references auth.users(id), -- who fronted the money
  type                text not null check (type in ('income', 'expense')),
  total_amount_cents  integer not null check (total_amount_cents > 0),
  split_mode          text not null check (split_mode in ('percentage', 'fixed_amount')),
  splits              jsonb not null, -- [{ "user_id": uuid, "share_cents": int }, ...]
  linked_movement_ids jsonb not null default '[]'::jsonb, -- [{ "user_id": uuid, "movement_id": uuid }, ...]
  date                timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

alter table ez_life.shared_movements enable row level security;

create policy "active members can read their space's shared movements" on ez_life.shared_movements
  for select to authenticated
  using (
    exists (
      select 1 from ez_life.memberships m
      where m.shared_space_id = shared_space_id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  );

-- No insert/update/delete policy — only via the RPCs below.

grant all on ez_life.shared_movements to anon, authenticated, service_role;

-- ── extend movements: the link back, and who may touch a linked row ────────

alter table ez_life.movements
  add column shared_movement_id uuid references ez_life.shared_movements(id) on delete set null,
  add column is_linked boolean not null default false;

-- The old single "own rows only" ALL policy can't express "visible either
-- way, but only writable when unlinked" — split it by command.
drop policy "own rows only" on ez_life.movements;

create policy "select own movements" on ez_life.movements
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

create policy "insert own unlinked movements" on ez_life.movements
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
    and coalesce(is_linked, false) = false
  );

create policy "update own unlinked movements" on ez_life.movements
  for update to authenticated
  using ((select auth.uid()) = user_id and coalesce(is_linked, false) = false)
  with check ((select auth.uid()) = user_id and coalesce(is_linked, false) = false);

create policy "delete own unlinked movements" on ez_life.movements
  for delete to authenticated
  using ((select auth.uid()) = user_id and coalesce(is_linked, false) = false);

-- ── notifications: one more type value ──────────────────────────────────────

alter table ez_life.notifications drop constraint notifications_type_check;
alter table ez_life.notifications add constraint notifications_type_check
  check (type in ('budget_over_80', 'goal_completed', 'daily_reminder', 'loan_due_soon', 'shared_movement_added'));

-- ── realtime: SC-003, near-instant updates when both members are online ───

alter publication supabase_realtime add table ez_life.shared_movements;

-- ── RPCs ─────────────────────────────────────────────────────────────────

create or replace function ez_life.create_shared_movement(
  p_space_id uuid,
  p_type text,
  p_total_amount_cents integer,
  p_split_mode text,
  p_splits jsonb,
  p_date timestamptz
) returns ez_life.shared_movements language plpgsql security definer set search_path to '' as $$
declare
  v_uid            uuid := auth.uid();
  v_shared_movement ez_life.shared_movements;
  v_split          jsonb;
  v_sum            integer := 0;
  v_linked         jsonb := '[]'::jsonb;
  v_movement_id    uuid;
  v_movement_type  text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from ez_life.memberships
    where shared_space_id = p_space_id and user_id = v_uid and left_at is null
  ) then
    raise exception 'Not a member of this space';
  end if;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    if not exists (
      select 1 from ez_life.memberships
      where shared_space_id = p_space_id
        and user_id = (v_split ->> 'user_id')::uuid
        and left_at is null
    ) then
      raise exception 'Split target is not an active member of this space';
    end if;
    v_sum := v_sum + (v_split ->> 'share_cents')::integer;
  end loop;

  if v_sum <> p_total_amount_cents then
    raise exception 'Splits do not sum to the total amount';
  end if;

  v_movement_type := upper(p_type);

  insert into ez_life.shared_movements
    (id, shared_space_id, created_by, type, total_amount_cents, split_mode, splits, date)
  values
    (gen_random_uuid(), p_space_id, v_uid, p_type, p_total_amount_cents, p_split_mode, p_splits, p_date)
  returning * into v_shared_movement;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    v_movement_id := gen_random_uuid();

    insert into ez_life.movements
      (id, user_id, type, amount, date, is_recurring, shared_movement_id, is_linked)
    values
      (v_movement_id, (v_split ->> 'user_id')::uuid, v_movement_type,
       (v_split ->> 'share_cents')::integer, p_date, false, v_shared_movement.id, true);

    v_linked := v_linked || jsonb_build_object('user_id', v_split ->> 'user_id', 'movement_id', v_movement_id);
  end loop;

  update ez_life.shared_movements
  set linked_movement_ids = v_linked, updated_at = now()
  where id = v_shared_movement.id
  returning * into v_shared_movement;

  return v_shared_movement;
end $$;

create or replace function ez_life.delete_shared_movement(p_id uuid)
  returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid      uuid := auth.uid();
  v_movement ez_life.shared_movements;
  v_link     jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_movement from ez_life.shared_movements where id = p_id and deleted_at is null;
  if not found then
    raise exception 'Shared movement not found';
  end if;

  if not exists (
    select 1 from ez_life.memberships
    where shared_space_id = v_movement.shared_space_id and user_id = v_uid and left_at is null
  ) then
    raise exception 'Not a member of this space';
  end if;

  if v_movement.created_by <> v_uid then
    if not exists (
      select 1 from ez_life.shared_spaces
      where id = v_movement.shared_space_id and permission_mode = 'open'
    ) then
      raise exception 'Not allowed to delete this shared movement';
    end if;
  end if;

  for v_link in select * from jsonb_array_elements(v_movement.linked_movement_ids)
  loop
    update ez_life.movements
    set deleted_at = now(), updated_at = now()
    where id = (v_link ->> 'movement_id')::uuid;
  end loop;

  update ez_life.shared_movements
  set deleted_at = now(), updated_at = now()
  where id = p_id;
end $$;

revoke all on function ez_life.create_shared_movement(uuid, text, integer, text, jsonb, timestamptz) from public;
revoke all on function ez_life.delete_shared_movement(uuid) from public;
grant execute on function ez_life.create_shared_movement(uuid, text, integer, text, jsonb, timestamptz) to authenticated;
grant execute on function ez_life.delete_shared_movement(uuid) to authenticated;
