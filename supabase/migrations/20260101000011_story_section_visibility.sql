-- =====================================================================
-- 11) 우수자별 파트 표시/숨김
-- - winners.hidden_sections: 공개 화면에서 숨길 파트 목록 (as_is / actions / to_be / reflection, 기본 빈 배열 = 모두 표시)
-- - get_public_awards(): 숨긴 파트는 내용을 빈 문자열로 내려보내고(내용 비노출) hidden_sections 를 함께 내려줌
-- - restore_awards(): hidden_sections 도 복원 (없으면 모두 표시, 이전 백업 호환)
-- 기존 마이그레이션은 수정하지 않습니다. 다시 실행해도 안전합니다.
-- =====================================================================
alter table public.winners
  add column if not exists hidden_sections text[] not null default '{}';
alter table public.winners drop constraint if exists winners_hidden_sections_check;
alter table public.winners
  add constraint winners_hidden_sections_check
    check (hidden_sections <@ array['as_is', 'actions', 'to_be', 'reflection']::text[]);

-- 공개 우수자 목록: 숨긴 파트는 내용 없이
create or replace function public.get_public_awards()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(
      case when w.is_revealed then
        jsonb_build_object(
          'id', w.id,
          'display_order', w.display_order,
          'name', w.name,
          'dept', w.dept,
          'position', w.position,
          'photo_url', w.photo_url,
          'topic', w.topic,
          'as_is', case when 'as_is' = any(w.hidden_sections) then '' else w.as_is end,
          'actions', case when 'actions' = any(w.hidden_sections) then '' else w.actions end,
          'to_be', case when 'to_be' = any(w.hidden_sections) then '' else w.to_be end,
          'reflection', case when 'reflection' = any(w.hidden_sections) then '' else w.reflection end,
          'attachment_url', w.attachment_url,
          'attachment_name', w.attachment_name,
          'hidden_sections', to_jsonb(w.hidden_sections),
          'is_revealed', true
        )
      else
        jsonb_build_object(
          'id', w.id,
          'display_order', w.display_order,
          'name', w.name,
          'dept', w.dept,
          'is_revealed', false
        )
      end
      order by w.display_order, w.created_at
    )
    from public.winners w
  ), '[]'::jsonb);
$$;

revoke execute on function public.get_public_awards() from public;
grant execute on function public.get_public_awards() to anon, authenticated;

-- 복원: 숨김 파트 항목 추가
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
  if s ? 'intro_mode' and (s ->> 'intro_mode') not in ('instant', 'cinematic') then
    raise exception 'settings.intro_mode 는 instant 또는 cinematic 이어야 합니다.' using errcode = 'invalid_parameter_value';
  end if;
  if s ? 'music_source' and (s ->> 'music_source') not in ('default', 'upload') then
    raise exception 'settings.music_source 는 default 또는 upload 여야 합니다.' using errcode = 'invalid_parameter_value';
  end if;
  if s ? 'music_volume' and (jsonb_typeof(s -> 'music_volume') <> 'number'
      or (s ->> 'music_volume')::numeric not between 0 and 1) then
    raise exception 'settings.music_volume 은 0~1 사이 숫자여야 합니다.' using errcode = 'invalid_parameter_value';
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

  -- 첨부 파일(선택): 있으면 형식·길이 검사
  i := 0;
  for w in select value from jsonb_array_elements(payload -> 'winners') loop
    i := i + 1;
    if w ? 'attachment_url' and jsonb_typeof(w -> 'attachment_url') not in ('string', 'null') then
      raise exception '%번째 우수자의 첨부 파일 주소 형식이 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
    if w ? 'attachment_name' and jsonb_typeof(w -> 'attachment_name') not in ('string', 'null') then
      raise exception '%번째 우수자의 첨부 파일 이름 형식이 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
    if char_length(coalesce(w ->> 'attachment_url', '')) > 1000 or char_length(coalesce(w ->> 'attachment_name', '')) > 200 then
      raise exception '%번째 우수자의 첨부 파일 정보가 너무 깁니다.', i using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- 화면에서 숨길 파트(선택): 있으면 배열이고 as_is/actions/to_be/reflection 만
  i := 0;
  for w in select value from jsonb_array_elements(payload -> 'winners') loop
    i := i + 1;
    if w ? 'hidden_sections' and jsonb_typeof(w -> 'hidden_sections') not in ('array', 'null') then
      raise exception '%번째 우수자의 숨김 파트 형식이 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_typeof(w -> 'hidden_sections') = 'array' and exists (
      select 1 from jsonb_array_elements(w -> 'hidden_sections') x
      where jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('as_is', 'actions', 'to_be', 'reflection')
    ) then
      raise exception '%번째 우수자의 숨김 파트 값이 올바르지 않습니다.', i using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- ---------- 대체 (같은 트랜잭션) ----------
  delete from public.winners where true;

  insert into public.winners
    (id, display_order, name, dept, position, photo_url, topic, as_is, actions, to_be, reflection, is_revealed,
     attachment_url, attachment_name, hidden_sections)
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
    coalesce((e ->> 'is_revealed')::boolean, false),
    case when nullif(e ->> 'attachment_url', '') is not null then e ->> 'attachment_url' end,
    case when nullif(e ->> 'attachment_url', '') is not null then coalesce(nullif(e ->> 'attachment_name', ''), '첨부파일') end,
    case when jsonb_typeof(e -> 'hidden_sections') = 'array'
      then array(select distinct x from jsonb_array_elements_text(e -> 'hidden_sections') as x order by x)
      else '{}'::text[] end
  from jsonb_array_elements(payload -> 'winners') with ordinality as t(e, ord);

  update public.site_settings
     set event_title = s ->> 'event_title',
         event_subtitle = s ->> 'event_subtitle',
         year = (s ->> 'year')::int,
         intro_line = s ->> 'intro_line',
         intro_enabled = coalesce((s ->> 'intro_enabled')::boolean, true),
         intro_length = s ->> 'intro_length',
         intro_mode = coalesce(s ->> 'intro_mode', 'instant'),
         sound_default = coalesce((s ->> 'sound_default')::boolean, true),
         accent_color = s ->> 'accent_color',
         fanfare_url = nullif(s ->> 'fanfare_url', ''),
         bgm_url = nullif(s ->> 'bgm_url', ''),
         music_source = coalesce(s ->> 'music_source', 'default'),
         music_volume = coalesce((s ->> 'music_volume')::numeric, 0.5)
   where id = 1;
end;
$$;

revoke execute on function public.restore_awards(jsonb) from public, anon;
grant execute on function public.restore_awards(jsonb) to authenticated;

