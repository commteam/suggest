-- RLS·함수 동작 검증. 실패하면 예외로 중단됩니다.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users values
  ('11111111-1111-4111-8111-111111111111', 'admin@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'user@example.com')
on conflict do nothing;
insert into public.user_roles values ('11111111-1111-4111-8111-111111111111', 'admin') on conflict do nothing;

create or replace function pg_temp.expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED ERROR (%) BUT SUCCEEDED: %', needle, sql;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if needle is not null and position(needle in sqlerrm) = 0 and position(needle in sqlstate) = 0 then
    raise exception 'wrong error for %: % (%)', sql, sqlerrm, sqlstate;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- ---------- anon ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);

-- 테이블 직접 접근 불가
select pg_temp.expect_error('select * from public.winners', 'permission denied');
select pg_temp.expect_error('select * from public.site_settings', 'permission denied');
select pg_temp.expect_error('select * from public.user_roles', 'permission denied');
select pg_temp.expect_error('insert into public.presentation_events(kind) values (''refresh'')', 'permission denied');

-- 공개 설정: 해시 없음
do $$ declare j jsonb := public.get_public_settings(); begin
  if j ? 'access_code_hash' then raise exception 'hash leaked'; end if;
  if (j ->> 'access_code_set')::boolean then raise exception 'code should be unset'; end if;
end $$;

-- 코드 미설정 → 준비 중
select pg_temp.expect_error('select public.get_public_awards(''whatever'')', 'access_not_ready');
-- 관리자 함수 실행 불가
select pg_temp.expect_error('select public.set_access_code(''abcdef'')', 'permission denied');
select pg_temp.expect_error('select public.restore_awards(''{}''::jsonb)', 'permission denied');
select pg_temp.expect_error('select * from public.reveal_next()', 'permission denied');
reset role;

-- ---------- 일반 로그인 사용자 (관리자 아님) ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$ begin
  if (select count(*) from public.winners) <> 0 then raise exception 'non-admin can read winners'; end if;
  if (select count(*) from public.user_roles) <> 0 then raise exception 'non-admin sees other roles'; end if;
end $$;
select pg_temp.expect_error('insert into public.user_roles values (''22222222-2222-4222-8222-222222222222'', ''admin'')', 'permission denied');
select pg_temp.expect_error('insert into public.winners(name) values (''x'')', 'row-level security');
select pg_temp.expect_error('select public.set_access_code(''abcdef'')', '관리자만');
select pg_temp.expect_error('select public.restore_awards(''{"winners":[],"settings":{}}''::jsonb)', '관리자만');
select pg_temp.expect_error('select * from public.reveal_next()', '관리자만');
select pg_temp.expect_error('insert into storage.objects(bucket_id, name) values (''winner-photos'', ''x.webp'')', 'row-level security');
reset role;

-- ---------- 관리자 ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if not public.is_admin() then raise exception 'admin not recognized'; end if;
  if (select count(*) from public.winners) <> 5 then raise exception 'admin should see 5 seed winners'; end if;
end $$;
-- 해시 컬럼 직접 읽기/쓰기 불가
select pg_temp.expect_error('select access_code_hash from public.site_settings', 'permission denied');
select pg_temp.expect_error('update public.site_settings set access_code_hash = ''x''', 'permission denied');
select pg_temp.expect_error('select public.set_access_code(''abc'')', '6~64');
select public.set_access_code('award2026');
update public.site_settings set accent_color = '#cfd8e6' where id = 1;
insert into storage.objects(bucket_id, name) values ('winner-photos', 'a.webp');
reset role;

-- ---------- anon: 코드 확인 + 마스킹 ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if public.verify_access_code('wrong-code') then raise exception 'wrong code accepted'; end if;
  if not public.verify_access_code('award2026') then raise exception 'right code rejected'; end if;
  if not (public.get_public_settings() ->> 'access_code_set')::boolean then raise exception 'code should be set'; end if;
end $$;
select pg_temp.expect_error('select public.get_public_awards(''wrong-code'')', 'invalid_access_code');
select pg_temp.expect_error('select public.get_public_awards(null)', 'invalid_access_code');
do $$
declare
  j jsonb := public.get_public_awards('award2026');
  hidden jsonb;
begin
  if jsonb_array_length(j) <> 5 then raise exception 'expected 5, got %', jsonb_array_length(j); end if;
  for hidden in select value from jsonb_array_elements(j) where (value ->> 'is_revealed')::boolean = false loop
    if (select array_agg(k order by k) from jsonb_object_keys(hidden) k) <> array['dept','display_order','id','is_revealed','name'] then
      raise exception 'hidden winner leaks fields: %', hidden;
    end if;
  end loop;
  if j::text like '%컴프레서%' then raise exception 'unrevealed topic leaked'; end if;
  if not (j -> 0 ? 'topic') then raise exception 'revealed winner missing topic'; end if;
  if (j -> 0 ->> 'display_order')::int <> 1 then raise exception 'order wrong'; end if;
end $$;
-- 스토리지 목록 조회로 파일명 노출 안 됨
do $$ begin
  if (select count(*) from storage.objects) <> 0 then raise exception 'anon can list storage objects'; end if;
end $$;
-- 이벤트 읽기는 가능
select count(*) >= 0 as can_read_events from public.presentation_events;
reset role;

-- ---------- 관리자: 발표/순서/복원 ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ declare w public.winners; begin
  select * into w from public.reveal_next();
  if w.name <> '최민준' then raise exception 'reveal_next wrong: %', w.name; end if;
  if not exists (select 1 from public.presentation_events where kind = 'reveal' and winner_id = w.id) then
    raise exception 'reveal event missing';
  end if;
end $$;
select public.reorder_winners(array[
  '00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004']::uuid[]);
do $$ begin
  if (select name from public.winners where display_order = 1) <> '정유진' then raise exception 'reorder failed'; end if;
end $$;
select public.set_all_revealed(false);
do $$ begin
  if exists (select 1 from public.winners where is_revealed) then raise exception 'hide all failed'; end if;
end $$;

-- restore: 검증 실패 시 기존 데이터 유지
select pg_temp.expect_error('select public.restore_awards(''{"settings":{}}''::jsonb)', 'winners 항목이 없습니다');
select pg_temp.expect_error('select public.restore_awards(''{"winners":{},"settings":{}}''::jsonb)', '배열');
select pg_temp.expect_error($q$select public.restore_awards(jsonb_build_object('winners', (select jsonb_agg(jsonb_build_object('name','n')) from generate_series(1,11)), 'settings', '{}'::jsonb))$q$, '최대 10명');
select pg_temp.expect_error('select public.restore_awards(''{"winners":[]}''::jsonb)', 'settings 항목이 없습니다');
select pg_temp.expect_error('select public.restore_awards(''{"winners":[],"settings":[]}''::jsonb)', '객체');
select pg_temp.expect_error($q$select public.restore_awards('{"winners":[{"name":"a"}],"settings":{"event_title":"t","event_subtitle":"s","intro_line":"l","accent_color":"#ffffff","intro_length":"short","year":2026}}'::jsonb)$q$, 'dept');
do $$ begin
  if (select count(*) from public.winners) <> 5 then raise exception 'data lost after failed restore'; end if;
end $$;

-- restore: 정상
select public.restore_awards($j${
  "settings": {"event_title":"복원 테스트","event_subtitle":"부제","intro_line":"문구","accent_color":"#d9b45a",
               "intro_length":"short","year":2027,"intro_enabled":false,"sound_default":true,"fanfare_url":null,"bgm_url":null},
  "winners": [
    {"name":"가","dept":"A","topic":"t","as_is":"a","actions":"b","to_be":"c","reflection":"d","is_revealed":true},
    {"id":"00000000-0000-4000-8000-0000000000aa","name":"나","dept":"B","position":"","topic":"t","as_is":"a","actions":"b","to_be":"c","reflection":"d"}
  ]}$j$::jsonb);
do $$ begin
  if (select count(*) from public.winners) <> 2 then raise exception 'restore count wrong'; end if;
  if (select event_title from public.site_settings) <> '복원 테스트' then raise exception 'settings not restored'; end if;
  if (select position from public.winners where name = '나') is not null then raise exception 'empty position should be null'; end if;
end $$;

-- 최대 10명 제약
select pg_temp.expect_error($q$insert into public.winners(name) select 'x' || g from generate_series(1, 9) g$q$, '최대 10명');
reset role;

-- 접속 코드는 복원 후에도 유지
do $$ begin
  if not public.verify_access_code('award2026') then raise exception 'code lost after restore'; end if;
end $$;

select 'ALL SECURITY TESTS PASSED' as result;
