-- Corrective migration for the grants of two ez_life tables.
--
-- Why: the `ez_life` schema has default privileges that grant ALL on every new
-- table to anon, authenticated and service_role (pg_default_acl: arwdDxtm). The
-- migrations for these tables only ran `revoke all ... from public, anon` and then
-- `grant select, insert, update ... to authenticated`, so `authenticated` kept the
-- default DELETE / TRUNCATE / REFERENCES / TRIGGER as well. TRUNCATE bypasses RLS,
-- and `authenticated` is shared by every app of the fleet (one auth.users pool), so
-- any signed-in user of any app could wipe these tables.
--
-- What: bring both tables to the grants their own migrations declare
-- (select, insert, update). Nothing needs more: ez_life.sync_record only does
-- INSERT ... ON CONFLICT DO UPDATE and deletes are soft (`deleted_at`); the
-- composite owner FKs are checked as the table owner, not as `authenticated`.
--
-- ez_life.achievement_receipts is already correct (its migration revokes from
-- authenticated before granting) and is left untouched.
--
-- Idempotent: REVOKE of a privilege that is not held is a no-op.

revoke delete, truncate, references, trigger on ez_life.payment_accounts from authenticated;
revoke delete, truncate, references, trigger on ez_life.movement_recurrences from authenticated;

-- Keep the intended privileges explicit (no-op when already present).
grant select, insert, update on ez_life.payment_accounts to authenticated;
grant select, insert, update on ez_life.movement_recurrences to authenticated;
