-- ============================================================================
-- ez_life — feature 001-family-finance-habits, convergence fix (T066).
--
-- FR-016 / US3 AC6: a member who leaves a shared space must still be able to
-- see that space's frozen balance/history ("visible para ambas partes en su
-- historial"). The SELECT policies on `shared_spaces` and `shared_movements`
-- required active membership (`ez_life.is_active_member`, i.e. `left_at is
-- null`) — once a member left, RLS blocked them from ever reading those rows
-- again, and the local `getAllForUser` query filtered the same way. This
-- migration relaxes read (not write) access to any current-or-former member.
-- `memberships` and `shared_invites` intentionally stay active-members-only:
-- an ex-member has no reason to see the live member roster or invite codes
-- of a space they're no longer part of.
-- ============================================================================

create or replace function ez_life.is_or_was_member(p_space_id uuid, p_user_id uuid)
  returns boolean language sql security definer stable set search_path to '' as $$
  select exists (
    select 1 from ez_life.memberships
    where shared_space_id = p_space_id and user_id = p_user_id
  );
$$;

revoke all on function ez_life.is_or_was_member(uuid, uuid) from public;
grant execute on function ez_life.is_or_was_member(uuid, uuid) to authenticated;

drop policy "active members can read their space" on ez_life.shared_spaces;
create policy "current or former members can read their space" on ez_life.shared_spaces
  for select to authenticated
  using (ez_life.is_or_was_member(id, (select auth.uid())));

drop policy "active members can read their space's shared movements" on ez_life.shared_movements;
create policy "current or former members can read their space's shared movements" on ez_life.shared_movements
  for select to authenticated
  using (ez_life.is_or_was_member(shared_space_id, (select auth.uid())));
