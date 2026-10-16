-- Run in the disposable harness scripts/verify-progress-sql.mjs only.
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
insert into ez_life.profiles(id) select id from auth.users;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
select ez_life.sync_record('achievement_receipts', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","achievement_id":"tasks","celebration_handled":true,"created_at":"2026-10-09T12:00:00Z","updated_at":"2026-10-09T12:00:00Z"}');
select ez_life.sync_record('achievement_receipts', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","achievement_id":"tasks","celebration_handled":false,"created_at":"2026-10-09T12:00:00Z","updated_at":"2026-10-10T12:00:00Z"}');
do $$ begin
  if not (select celebration_handled from ez_life.achievement_receipts) then raise exception 'history regressed'; end if;
  begin
    insert into ez_life.achievement_receipts values ('22222222-2222-4222-a222-222222222222', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'tasks', false, now(), now(), null);
    raise exception 'duplicate accepted';
  exception when unique_violation then null; end;
end $$;
select ez_life.sync_record('profiles', '{"id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","gamification_enabled":false,"updated_at":"2099-10-09T12:00:00Z"}');
do $$ begin
  if (select gamification_enabled from ez_life.profiles) then raise exception 'preference not saved'; end if;
end $$;
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  if exists (select 1 from ez_life.achievement_receipts) then raise exception 'cross-account read'; end if;
  begin
    insert into ez_life.achievement_receipts values ('33333333-3333-4333-a333-333333333333', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'goal', false, now(), now(), null);
    raise exception 'cross-account insert';
  exception when insufficient_privilege then null; end;
  update ez_life.achievement_receipts set celebration_handled = false;
end $$;
reset role;
do $$ begin
  if (select count(*) from ez_life.achievement_receipts) <> 1 or not (select celebration_handled from ez_life.achievement_receipts) then raise exception 'cross-account mutation'; end if;
end $$;
set role anon;
do $$ begin
  begin perform count(*) from ez_life.achievement_receipts; raise exception 'anonymous read';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
