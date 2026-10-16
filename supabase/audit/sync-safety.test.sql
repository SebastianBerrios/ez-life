insert into auth.users values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
insert into ez_life.profiles(id) select id from auth.users;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
select ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","type":"INCOME","amount":100,"date":"2026-10-08T12:00:00Z","updated_at":"2026-10-08T12:00:00Z","description":"initial"}');
-- Older writes cannot overwrite a newer version.
select ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","type":"INCOME","amount":999,"date":"2026-10-08T12:00:00Z","updated_at":"2026-01-01T12:00:00Z"}');
do $$ begin
  if (select amount from ez_life.movements where id = '11111111-1111-4111-a111-111111111111') <> 100 then raise exception 'stale write won'; end if;
end $$;
-- Clearing an optional field really clears the server value.
select ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","type":"INCOME","amount":100,"date":"2026-10-08T12:00:00Z","updated_at":"2026-10-09T12:00:00Z","description":null}');
do $$ begin
  if (select description from ez_life.movements where id = '11111111-1111-4111-a111-111111111111') is not null then raise exception 'optional field retained'; end if;
end $$;
-- A tombstone wins against a live row irrespective of timestamp.
select ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","type":"INCOME","amount":100,"date":"2026-10-08T12:00:00Z","updated_at":"2026-01-01T12:00:00Z","deleted_at":"2026-10-08T12:00:00Z"}');
select ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","type":"INCOME","amount":999,"date":"2026-10-08T12:00:00Z","updated_at":"2099-10-08T12:00:00Z","deleted_at":null}');
do $$ begin
  if (select deleted_at from ez_life.movements where id = '11111111-1111-4111-a111-111111111111') is null then raise exception 'tombstone resurrected'; end if;
end $$;
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  if exists (select 1 from ez_life.movements) then raise exception 'cross-account read'; end if;
  begin
    perform ez_life.sync_record('movements', '{"id":"11111111-1111-4111-a111-111111111111","user_id":"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb","type":"INCOME","amount":999,"date":"2026-10-08T12:00:00Z","updated_at":"2099-10-08T12:00:00Z"}');
    -- A protected tombstone may make ON CONFLICT a harmless no-op. Verify
    -- the stored owner and amount after resetting the role below as well.
  exception when insufficient_privilege then null;
  end;
  begin
    perform ez_life.sync_record('shared_spaces', '{"id":"11111111-1111-4111-a111-111111111111","updated_at":"2026-10-08T12:00:00Z"}');
    raise exception 'unsupported table accepted';
  exception when raise_exception then
    if sqlerrm <> 'Unsupported sync table' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select user_id from ez_life.movements where id = '11111111-1111-4111-a111-111111111111') <> 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid
     or (select amount from ez_life.movements where id = '11111111-1111-4111-a111-111111111111') <> 100 then
    raise exception 'cross-account modification';
  end if;
end $$;
