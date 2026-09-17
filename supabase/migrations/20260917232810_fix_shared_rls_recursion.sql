-- ============================================================================
-- ez_life — fix: infinite recursion in RLS policies for the shared-space
-- tables, found via manual browser testing (Polish phase, T062).
--
-- `ez_life.memberships`' own SELECT policy queried `ez_life.memberships`
-- again to check "is this user an active member of this space" — a
-- self-referencing correlated subquery on the very table the policy
-- protects. Postgres's RLS policy expansion can't resolve that without
-- re-applying the same policy to the subquery's rows, so every read hit
-- "infinite recursion detected in policy for relation \"memberships\"" (a
-- 500 from PostgREST, not a permission denial). `shared_spaces`,
-- `shared_invites`, and `shared_movements` all had the same pattern one
-- hop away (their policies queried `memberships`, which then recursed into
-- itself the same way).
--
-- Standard fix (the same pattern Supabase's own docs recommend for this
-- exact situation): move the membership check into a SECURITY DEFINER
-- function. Because the function runs as its owner (not as `authenticated`),
-- its internal query against `memberships` bypasses RLS entirely instead of
-- re-triggering the policy — breaking the cycle.
-- ============================================================================

create or replace function ez_life.is_active_member(p_space_id uuid, p_user_id uuid)
  returns boolean language sql security definer stable set search_path to '' as $$
  select exists (
    select 1 from ez_life.memberships
    where shared_space_id = p_space_id and user_id = p_user_id and left_at is null
  );
$$;

revoke all on function ez_life.is_active_member(uuid, uuid) from public;
grant execute on function ez_life.is_active_member(uuid, uuid) to authenticated;

drop policy "active members can read their space" on ez_life.shared_spaces;
create policy "active members can read their space" on ez_life.shared_spaces
  for select to authenticated
  using (ez_life.is_active_member(id, (select auth.uid())));

drop policy "active members can update permission_mode" on ez_life.shared_spaces;
create policy "active members can update permission_mode" on ez_life.shared_spaces
  for update to authenticated
  using (ez_life.is_active_member(id, (select auth.uid())))
  with check (ez_life.is_active_member(id, (select auth.uid())));

drop policy "active members can read all memberships of their spaces" on ez_life.memberships;
create policy "active members can read all memberships of their spaces" on ez_life.memberships
  for select to authenticated
  using (ez_life.is_active_member(shared_space_id, (select auth.uid())));

drop policy "active members can read their space's invites" on ez_life.shared_invites;
create policy "active members can read their space's invites" on ez_life.shared_invites
  for select to authenticated
  using (ez_life.is_active_member(shared_space_id, (select auth.uid())));

drop policy "active members can read their space's shared movements" on ez_life.shared_movements;
create policy "active members can read their space's shared movements" on ez_life.shared_movements
  for select to authenticated
  using (ez_life.is_active_member(shared_space_id, (select auth.uid())));
