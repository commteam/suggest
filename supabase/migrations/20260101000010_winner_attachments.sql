-- =====================================================================
-- 10) 우수자별 첨부 파일
-- - winners.attachment_url / attachment_name 추가 (둘 다 비어 있거나 둘 다 채워짐)
-- - Storage 버킷 winner-files: 읽기 공개(공개 URL), 쓰기는 관리자만, 20MB, 문서·이미지·압축 형식만
-- - get_public_awards(): 공개된 사람에게만 첨부 파일 정보를 내려줌 (공개 전 인물은 지금처럼 이름·소속·순서만)
-- - restore_awards(): 첨부 파일 항목도 복원 (없으면 비움, 이전 백업 호환)
-- 기존 마이그레이션은 수정하지 않습니다. 다시 실행해도 안전합니다.
-- =====================================================================
alter table public.winners
  add column if not exists attachment_url text
    constraint winners_attachment_url_check check (attachment_url is null or char_length(attachment_url) <= 1000);
alter table public.winners
  add column if not exists attachment_name text
    constraint winners_attachment_name_check check (attachment_name is null or char_length(attachment_name) between 1 and 200);
alter table public.winners drop constraint if exists winners_attachment_pair_check;
alter table public.winners
  add constraint winners_attachment_pair_check check ((attachment_url is null) = (attachment_name is null));

-- 첨부 파일 버킷 (파일명은 UUID, 원래 이름은 attachment_name 에 저장)
-- 06 과 같은 이유로 anon SELECT 정책은 만들지 않습니다(목록 조회로 공개 전 파일을 찾지 못하도록).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('winner-files', 'winner-files', true, 20971520,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/x-hwp',
      'application/vnd.hancom.hwpx',
      'application/zip',
      'image/png',
      'image/jpeg',
      'text/plain'
    ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "awards files: 관리자 읽기" on storage.objects;
drop policy if exists "awards files: 관리자 업로드" on storage.objects;
drop policy if exists "awards files: 관리자 수정" on storage.objects;
drop policy if exists "awards files: 관리자 삭제" on storage.objects;

create policy "awards files: 관리자 읽기" on storage.objects for select to authenticated
  using (bucket_id = 'winner-files' and (select public.is_admin()));
create policy "awards files: 관리자 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'winner-files' and (select public.is_admin()));
create policy "awards files: 관리자 수정" on storage.objects for update to authenticated
  using (bucket_id = 'winner-files' and (select public.is_admin()))
  with check (bucket_id = 'winner-files' and (select public.is_admin()));
create policy "awards files: 관리자 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'winner-files' and (select public.is_admin()));

-- 공개 우수자 목록: 공개된 사람에게만 첨부 파일 정보 추가
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
          'as_is', w.as_is,
          'actions', w.actions,
          'to_be', w.to_be,
          'reflection', w.reflection,
          'attachment_url', w.attachment_url,
          'attachment_name', w.attachment_name,
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

-- 복원: 첨부 파일 항목 추가
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

  -- ---------- 대체 (같은 트랜잭션) ----------
  delete from public.winners where true;

  insert into public.winners
    (id, display_order, name, dept, position, photo_url, topic, as_is, actions, to_be, reflection, is_revealed,
     attachment_url, attachment_name)
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
    case when nullif(e ->> 'attachment_url', '') is not null then coalesce(nullif(e ->> 'attachment_name', ''), '첨부파일') end
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
