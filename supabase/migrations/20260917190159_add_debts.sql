-- ============================================================================
-- ez_life.debts — feature 001-family-finance-habits, User Story 1.
--
-- Settling a debt is bookkeeping only (Principio X / FR-004): the app never
-- creates a Movement from a settlement, and this table has no relationship to
-- ez_life.movements for that reason. `shared_movement_id` is a plain nullable
-- uuid (no FK yet) because `shared_movements` doesn't exist until User
-- Story 3 — it will get its foreign key added in that story's migration.
-- ============================================================================

create table ez_life.debts (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  counterparty_name   text not null,
  direction           text not null check (direction in ('lent', 'borrowed')),
  origin              text not null check (origin in ('manual', 'shared_expense')),
  shared_movement_id  uuid,
  amount              integer not null check (amount > 0), -- cents
  settled_amount      integer not null default 0 check (settled_amount >= 0 and settled_amount <= amount), -- cents
  due_date            timestamptz,
  interest_rate       numeric, -- informational only (spec.md Assumptions), never recalculated
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

alter table ez_life.debts enable row level security;

create policy "own rows only" on ez_life.debts
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

grant all on ez_life.debts to anon, authenticated, service_role;
