-- =====================================================================
-- 7) JSON 백업 복원
-- SECURITY INVOKER: 호출한 관리자의 권한(RLS)으로 실행됩니다.
-- 모든 검증을 삭제 전에 끝내고, 함수 전체가 한 트랜잭션이라 중간 실패 시 원상복구됩니다.
-- 접속 코드 해시는 백업/복원 대상이 아닙니다.
-- =====================================================================
create or replace function public.restore_awards(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w jsonb;
  s jsonb;
  i int := 0;
  f text;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if not public.is_admin() then
    raise exception '관리자만 복원할 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;

  -- ---------- 검증 (삭제 전) ----------
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception '백업 형식이 올바르지 않습니다.' using errcode = 'invalid_parameter_value';
  end if;

  if payload -> 'winners' is null then
    raise exception 'winners 항목이 없습니다.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(payload -> 'winners') <> 'array' then
    raise exception 'winners 항목은 배열이어야 합니다.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(payload -> 'winners') > 10 then
    raise exception '우수자는 최대 10명까지 가능합니다. (현재 %명)', jsonb_array_length(payload -> 'winners')
      using errcode = 'invalid_parameter_value';
  end if;

  s := payload -> 'settings';
  if s is null then
    raise exception 'settings 항목이 없습니다.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(s) <> 'object' then
    raise exception 'settings 항목은 객체여야 합니다.' using errcode = 'invalid_parameter_value';
  end if;
  foreach f in array array['event_title', 'event_subtitle', 'intro_line', 'accent_color', 'intro_length'] loop
    if jsonb_typeof(s -> f) is distinct from 'string' then
      raise exception 'settings.% 값이 없습니다.', f using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if jsonb_typeof(s -> 'year') is distinct from 'number' then
    raise exception 'settings.year 값이 올바르지 않습니다.' using errcode = 'invalid_parameter_value';
  end if;
  if (s ->> 'accent_color') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'settings.accent_color 는 #RRGGBB 형식이어야 합니다.' using errcode = 'invalid_parameter_value';
  end if;
  if (s ->> 'intro_length') not in ('standard', 'short') then
    raise exception 'settings.intro_length 는 standard 또는 short 여야 합니다.' using errcode = 'invalid_parameter_value';
  end if;

  for w in select value from jsonb_array_elements(payload -> 'winners') loop
    i := i + 1;
    if jsonb_typeof(w) <> 'object' then
      raise exception '%번째 우수자 데이터가 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
    foreach f in array array['name', 'dept', 'topic', 'as_is', 'actions', 'to_be', 'reflection'] loop
      if jsonb_typeof(w -> f) is distinct from 'string' then
        raise exception '%번째 우수자의 % 값이 없습니다.', i, f using errcode = 'invalid_parameter_value';
      end if;
    end loop;
    if btrim(w ->> 'name') = '' then
      raise exception '%번째 우수자의 이름이 비어 있습니다.', i using errcode = 'invalid_parameter_value';
    end if;
    if w ? 'id' and jsonb_typeof(w -> 'id') = 'string' and (w ->> 'id') !~ uuid_re then
      raise exception '%번째 우수자의 id 형식이 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- ---------- 대체 (같은 트랜잭션) ----------
  delete from public.winners where true;

  insert into public.winners
    (id, display_order, name, dept, position, photo_url, topic, as_is, actions, to_be, reflection, is_revealed)
  select
    coalesce(case when jsonb_typeof(e -> 'id') = 'string' then (e ->> 'id')::uuid end, gen_random_uuid()),
    t.ord::int,
    btrim(e ->> 'name'),
    e ->> 'dept',
    nullif(e ->> 'position', ''),
    nullif(e ->> 'photo_url', ''),
    e ->> 'topic',
    e ->> 'as_is',
    e ->> 'actions',
    e ->> 'to_be',
    e ->> 'reflection',
    coalesce((e ->> 'is_revealed')::boolean, false)
  from jsonb_array_elements(payload -> 'winners') with ordinality as t(e, ord);

  update public.site_settings
     set event_title = s ->> 'event_title',
         event_subtitle = s ->> 'event_subtitle',
         year = (s ->> 'year')::int,
         intro_line = s ->> 'intro_line',
         intro_enabled = coalesce((s ->> 'intro_enabled')::boolean, true),
         intro_length = s ->> 'intro_length',
         sound_default = coalesce((s ->> 'sound_default')::boolean, true),
         accent_color = s ->> 'accent_color',
         fanfare_url = nullif(s ->> 'fanfare_url', ''),
         bgm_url = nullif(s ->> 'bgm_url', '')
   where id = 1;
end;
$$;

revoke execute on function public.restore_awards(jsonb) from public, anon;
grant execute on function public.restore_awards(jsonb) to authenticated;
