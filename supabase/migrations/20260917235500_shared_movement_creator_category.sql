-- ============================================================================
-- ez_life — feature 001-family-finance-habits, convergence fix (T067).
--
-- FR-012: shared movements must count within each member's personal budget
-- distribution. `create_shared_movement` never set `distribution_category_id`
-- on any linked Movement it created — not even the creator's own, even
-- though the creator owns their own DistributionCategory rows and could
-- always assign one. That left every shared movement out of
-- `calculateSpentByBucket`'s per-bucket totals (Dashboard "Presupuestos
-- 50/30/20", budget_over_80 alerts). This lets the creator optionally pass
-- one of their own buckets for their own share; a non-creator member's share
-- stays uncategorized — the creator has no RLS access to another member's
-- private DistributionCategory rows, so there is nothing valid to assign on
-- their behalf (documented, structural limitation, out of scope here).
-- ============================================================================

drop function ez_life.create_shared_movement(uuid, text, integer, text, jsonb, timestamptz);

create or replace function ez_life.create_shared_movement(
  p_space_id uuid,
  p_type text,
  p_total_amount_cents integer,
  p_split_mode text,
  p_splits jsonb,
  p_date timestamptz,
  p_creator_distribution_category_id uuid default null
) returns ez_life.shared_movements language plpgsql security definer set search_path to '' as $$
declare
  v_uid            uuid := auth.uid();
  v_shared_movement ez_life.shared_movements;
  v_split          jsonb;
  v_sum            integer := 0;
  v_linked         jsonb := '[]'::jsonb;
  v_movement_id    uuid;
  v_movement_type  text;
  v_split_user     uuid;
  v_category_id    uuid;
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

  -- Defense in depth: the creator's bucket must actually belong to them, or
  -- it's silently dropped rather than trusted blindly from client input.
  if p_creator_distribution_category_id is not null and not exists (
    select 1 from ez_life.distribution_categories
    where id = p_creator_distribution_category_id and user_id = v_uid
  ) then
    p_creator_distribution_category_id := null;
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
    v_split_user := (v_split ->> 'user_id')::uuid;
    v_category_id := case when v_split_user = v_uid then p_creator_distribution_category_id else null end;

    insert into ez_life.movements
      (id, user_id, type, amount, date, is_recurring, shared_movement_id, is_linked, distribution_category_id)
    values
      (v_movement_id, v_split_user, v_movement_type,
       (v_split ->> 'share_cents')::integer, p_date, false, v_shared_movement.id, true, v_category_id);

    v_linked := v_linked || jsonb_build_object('user_id', v_split ->> 'user_id', 'movement_id', v_movement_id);
  end loop;

  update ez_life.shared_movements
  set linked_movement_ids = v_linked, updated_at = now()
  where id = v_shared_movement.id
  returning * into v_shared_movement;

  return v_shared_movement;
end $$;

revoke all on function ez_life.create_shared_movement(uuid, text, integer, text, jsonb, timestamptz, uuid) from public;
grant execute on function ez_life.create_shared_movement(uuid, text, integer, text, jsonb, timestamptz, uuid) to authenticated;
