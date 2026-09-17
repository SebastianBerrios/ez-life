-- ============================================================================
-- ez_life — feature 001-family-finance-habits, User Story 2.
-- Shared financial space: creation, invite/redeem, leaving.
--
-- Every mutation that could ever create or grant a Membership goes through a
-- SECURITY DEFINER RPC — never a direct client insert (Principio IX). This is
-- one RPC more than contracts/rpc-functions.md originally specified
-- (create_shared_space) — discovered during implementation: without it,
-- "create a space" would need a client-side insert into `memberships` for the
-- creator's own row, which is exactly the self-insert pattern the fleet's own
-- rules forbid. Wrapping creation in the same RPC pattern as redemption
-- closes that gap.
-- ============================================================================

create table ez_life.shared_spaces (
  id              uuid primary key,
  name            text not null,
  permission_mode text not null default 'strict' check (permission_mode in ('strict', 'open')),
  status          text not null default 'active' check (status in ('active', 'archived')),
  created_by      uuid not null references auth.users(id), -- informational only, no admin role
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table ez_life.memberships (
  id               uuid primary key,
  shared_space_id  uuid not null references ez_life.shared_spaces(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  left_at          timestamptz, -- presence means the member left; never reactivated
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table ez_life.shared_invites (
  id               uuid primary key,
  shared_space_id  uuid not null references ez_life.shared_spaces(id) on delete cascade,
  code             text not null unique,
  created_by       uuid not null references auth.users(id),
  expires_at       timestamptz not null,
  redeemed_by      uuid references auth.users(id),
  redeemed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

alter table ez_life.shared_spaces  enable row level security;
alter table ez_life.memberships    enable row level security;
alter table ez_life.shared_invites enable row level security;

-- A member can see/update a space they're currently active in. No INSERT or
-- DELETE policy on any of the three tables below — every row that could ever
-- grant membership is created exclusively by the RPCs at the bottom of this
-- file, which run as SECURITY DEFINER and bypass RLS.

create policy "active members can read their space" on ez_life.shared_spaces
  for select to authenticated
  using (
    exists (
      select 1 from ez_life.memberships m
      where m.shared_space_id = id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  );

create policy "active members can update permission_mode" on ez_life.shared_spaces
  for update to authenticated
  using (
    exists (
      select 1 from ez_life.memberships m
      where m.shared_space_id = id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  )
  with check (
    exists (
      select 1 from ez_life.memberships m
      where m.shared_space_id = id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  );

create policy "active members can read all memberships of their spaces" on ez_life.memberships
  for select to authenticated
  using (
    exists (
      select 1 from ez_life.memberships m2
      where m2.shared_space_id = shared_space_id and m2.user_id = (select auth.uid()) and m2.left_at is null
    )
  );

create policy "active members can read their space's invites" on ez_life.shared_invites
  for select to authenticated
  using (
    exists (
      select 1 from ez_life.memberships m
      where m.shared_space_id = shared_space_id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  );

grant all on ez_life.shared_spaces, ez_life.memberships, ez_life.shared_invites
  to anon, authenticated, service_role;

-- ── RPCs ─────────────────────────────────────────────────────────────────

create or replace function ez_life.create_shared_space(p_name text)
  returns ez_life.shared_spaces language plpgsql security definer set search_path to '' as $$
declare
  v_uid   uuid := auth.uid();
  v_space ez_life.shared_spaces;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into ez_life.shared_spaces (id, name, created_by)
  values (gen_random_uuid(), p_name, v_uid)
  returning * into v_space;

  insert into ez_life.memberships (id, shared_space_id, user_id, joined_at)
  values (gen_random_uuid(), v_space.id, v_uid, now());

  return v_space;
end $$;

create or replace function ez_life.create_shared_invite(p_space_id uuid)
  returns ez_life.shared_invites language plpgsql security definer set search_path to '' as $$
declare
  v_uid    uuid := auth.uid();
  v_invite ez_life.shared_invites;
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

  insert into ez_life.shared_invites (id, shared_space_id, code, created_by, expires_at)
  values (
    gen_random_uuid(),
    p_space_id,
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
    v_uid,
    now() + interval '48 hours'
  )
  returning * into v_invite;

  return v_invite;
end $$;

-- The only place a Membership row is ever created for someone other than a
-- space's own creator. Deliberately generic-message on every failure branch
-- (expired / already used / never existed) so a caller can't use the error
-- to fish for whether a code ever existed (spec.md edge cases).
create or replace function ez_life.redeem_shared_invite(p_code text)
  returns ez_life.memberships language plpgsql security definer set search_path to '' as $$
declare
  v_uid       uuid := auth.uid();
  v_invite    ez_life.shared_invites;
  v_membership ez_life.memberships;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from ez_life.shared_invites
  where code = p_code and expires_at > now() and redeemed_by is null
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  if exists (
    select 1 from ez_life.memberships
    where shared_space_id = v_invite.shared_space_id and user_id = v_uid and left_at is null
  ) then
    raise exception 'Already a member of this space';
  end if;

  update ez_life.shared_invites
  set redeemed_by = v_uid, redeemed_at = now()
  where id = v_invite.id;

  insert into ez_life.memberships (id, shared_space_id, user_id, joined_at)
  values (gen_random_uuid(), v_invite.shared_space_id, v_uid, now())
  returning * into v_membership;

  return v_membership;
end $$;

create or replace function ez_life.leave_shared_space(p_space_id uuid)
  returns void language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update ez_life.memberships
  set left_at = now()
  where shared_space_id = p_space_id and user_id = v_uid and left_at is null;

  if not found then
    raise exception 'Not an active member of this space';
  end if;

  if not exists (
    select 1 from ez_life.memberships
    where shared_space_id = p_space_id and left_at is null
  ) then
    update ez_life.shared_spaces set status = 'archived' where id = p_space_id;
  end if;
end $$;

revoke all on function ez_life.create_shared_space(text) from public;
revoke all on function ez_life.create_shared_invite(uuid) from public;
revoke all on function ez_life.redeem_shared_invite(text) from public;
revoke all on function ez_life.leave_shared_space(uuid) from public;
grant execute on function ez_life.create_shared_space(text) to authenticated;
grant execute on function ez_life.create_shared_invite(uuid) to authenticated;
grant execute on function ez_life.redeem_shared_invite(text) to authenticated;
grant execute on function ez_life.leave_shared_space(uuid) to authenticated;
