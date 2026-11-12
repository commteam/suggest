-- =====================================================================
-- 4) 공개 데이터 API
-- 접속 코드가 맞을 때만 우수자 목록을 돌려주고,
-- 공개 전(is_revealed=false)인 사람은 id·순서·이름·소속만 포함합니다.
-- 사진 URL·직급·제안 내용은 JSON 에 아예 들어가지 않으므로 개발자도구로도 볼 수 없습니다.
-- =====================================================================
create or replace function public.get_public_awards(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h text;
begin
  select access_code_hash into h from public.site_settings where id = 1;
  if h is null then
    raise exception 'access_not_ready' using errcode = 'P0001', hint = '접속 코드가 아직 설정되지 않았습니다.';
  end if;
  if code is null or char_length(code) = 0 or char_length(code) > 200 or extensions.crypt(code, h) <> h then
    raise exception 'invalid_access_code' using errcode = '28P01', hint = '접속 코드가 올바르지 않습니다.';
  end if;

  return coalesce((
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
end;
$$;

revoke execute on function public.get_public_awards(text) from public;
grant execute on function public.get_public_awards(text) to anon, authenticated;
