-- ============================================================================
-- ez_life.installment_loans / ez_life.installment_payments — feature
-- 002-mobile-nav-loans-ux, User Story 3.
--
-- A separate entity from ez_life.debts on purpose (spec.md, research.md #3):
-- bank/caja loans with a lender-defined installment schedule. The app never
-- computes an amortization table — amount/installment_count/installment_amount
-- come verbatim from the user (FR-011, FR-012); interest_rate is informational
-- only (FR-013).
--
-- Recording a payment is bookkeeping only (Principio X / FR-027): this schema
-- has no relationship to ez_life.movements, same as ez_life.debts.
-- ============================================================================

create table ez_life.installment_loans (
  id                      uuid primary key,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  lender_name             text not null,
  amount                  integer not null check (amount > 0), -- cents
  installment_count       integer not null check (installment_count > 0),
  remaining_installments  integer not null check (remaining_installments >= 0 and remaining_installments <= installment_count),
  installment_amount      integer not null check (installment_amount > 0), -- cents, current
  interest_rate           numeric, -- informational only (FR-013), never recalculated
  status                  text not null default 'active' check (status in ('active', 'settled')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

alter table ez_life.installment_loans enable row level security;

create policy "own rows only" on ez_life.installment_loans
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid()))
  );

grant all on ez_life.installment_loans to anon, authenticated, service_role;

-- Append-only payment log (FR-026). Scoped via its parent loan's user_id
-- rather than its own column, since a payment always belongs to exactly one
-- loan and never changes owner.
create table ez_life.installment_payments (
  id                    uuid primary key,
  installment_loan_id   uuid not null references ez_life.installment_loans(id) on delete cascade,
  kind                  text not null check (kind in ('installment', 'principal')),
  amount                integer not null check (amount > 0), -- cents
  date                  timestamptz not null,
  adjustment_type       text check (adjustment_type in ('reduce_term', 'reduce_installment_amount')),
  resulting_value       integer, -- the value the user typed in themselves — never calculated (FR-017)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint principal_fields_together check (
    (kind = 'principal' and adjustment_type is not null and resulting_value is not null)
    or (kind = 'installment' and adjustment_type is null and resulting_value is null)
  )
);

alter table ez_life.installment_payments enable row level security;

create policy "own rows only" on ez_life.installment_payments
  for all to authenticated
  using (
    exists (
      select 1 from ez_life.installment_loans l
      where l.id = installment_loan_id and l.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from ez_life.installment_loans l
      where l.id = installment_loan_id and l.user_id = (select auth.uid())
    )
  );

grant all on ez_life.installment_payments to anon, authenticated, service_role;
