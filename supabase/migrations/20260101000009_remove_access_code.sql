-- =====================================================================
-- 9) 접속 코드 기능 제거: 누구나 바로 입장
-- - get_public_awards / get_public_settings 를 접속 코드 없이 동작하도록 교체하고 anon 에 실행 권한 부여
-- - 공개 전(is_revealed=false) 인물은 지금처럼 id·순서·이름·소속만 내려감 (사진·직급·제안 내용 없음)
-- - verify_access_code / set_access_code 함수 삭제
-- - site_settings.access_code_hash 컬럼은 삭제하지 않고 사용하지 않는 상태로 남김
-- 기존 마이그레이션 파일은 수정하지 않습니다. 다시 실행해도 안전합니다.
-- =====================================================================

-- 공개 우수자 목록: 접속 코드 불필요 (인자 없음).
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

comment on function public.get_public_awards() is
  '공개 우수자 목록. 접속 코드 불필요. 공개 전 인물은 이름·소속·순서만.';

-- 예전 클라이언트 호환: { code } 를 보내도 코드는 무시하고 같은 결과
-- (기존 마이그레이션 04 를 다시 실행해도 충돌하지 않도록 기본값 없이 같은 시그니처로 교체)
create or replace function public.get_public_awards(code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_public_awards();
$$;

revoke execute on function public.get_public_awards() from public;
revoke execute on function public.get_public_awards(text) from public;
grant execute on function public.get_public_awards() to anon, authenticated;
grant execute on function public.get_public_awards(text) to anon, authenticated;

-- 공개 설정: 접속 코드 관련 항목 제거 (해시는 여전히 내보내지 않음)
create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_title', s.event_title,
    'event_subtitle', s.event_subtitle,
    'year', s.year,
    'intro_line', s.intro_line,
    'intro_enabled', s.intro_enabled,
    'intro_length', s.intro_length,
    'intro_mode', s.intro_mode,
    'sound_default', s.sound_default,
    'accent_color', s.accent_color,
    'fanfare_url', s.fanfare_url,
    'bgm_url', s.bgm_url,
    'music_source', s.music_source,
    'music_volume', s.music_volume
  )
  from public.site_settings s
  where s.id = 1;
$$;

revoke execute on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;

-- 접속 코드 함수 삭제
drop function if exists public.verify_access_code(text);
drop function if exists public.set_access_code(text);

comment on column public.site_settings.access_code_hash is
  '사용하지 않음 (20260101000009 에서 접속 코드 기능 제거). 데이터 보존을 위해 컬럼만 남김.';
