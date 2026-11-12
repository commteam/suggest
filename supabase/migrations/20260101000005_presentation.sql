-- =====================================================================
-- 5) 발표 모드 (Realtime)
-- presentation_events 에는 이벤트 종류와 winner_id 만 담습니다(내용 없음).
-- 공개 화면은 이 테이블의 INSERT 를 구독하고, 신호를 받으면 get_public_awards 로 다시 읽습니다.
-- =====================================================================
create table if not exists public.presentation_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('reveal', 'reveal_all', 'hide_all', 'refresh')),
  winner_id uuid,
  created_at timestamptz not null default now()
);

alter table public.presentation_events enable row level security;

drop policy if exists "presentation_events: 누구나 읽기" on public.presentation_events;
drop policy if exists "presentation_events: 관리자 추가" on public.presentation_events;
create policy "presentation_events: 누구나 읽기" on public.presentation_events for select to anon, authenticated using (true);
create policy "presentation_events: 관리자 추가" on public.presentation_events for insert to authenticated with check ((select public.is_admin()));

revoke all on public.presentation_events from anon, authenticated;
grant select on public.presentation_events to anon, authenticated;
grant insert on public.presentation_events to authenticated;

-- Realtime 구독 대상에 추가
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'presentation_events'
     ) then
    alter publication supabase_realtime add table public.presentation_events;
  end if;
end $$;

-- 데이터가 바뀌면 공개 화면에 "refresh" 신호 (오래된 이벤트는 정리)
create or replace function public.emit_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.presentation_events where created_at < now() - interval '1 day';
  insert into public.presentation_events (kind) values ('refresh');
  return null;
end;
$$;

drop trigger if exists winners_emit_refresh on public.winners;
create trigger winners_emit_refresh after insert or update or delete on public.winners
  for each statement execute function public.emit_refresh();
drop trigger if exists site_settings_emit_refresh on public.site_settings;
create trigger site_settings_emit_refresh after update on public.site_settings
  for each statement execute function public.emit_refresh();

-- 관리자: 다음 사람 공개
create or replace function public.reveal_next()
returns setof public.winners
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w public.winners;
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;
  update public.winners
     set is_revealed = true
   where id = (
     select id from public.winners where not is_revealed order by display_order, created_at limit 1
   )
  returning * into w;
  if w.id is null then
    return;
  end if;
  insert into public.presentation_events (kind, winner_id) values ('reveal', w.id);
  return next w;
end;
$$;

-- 관리자: 전체 공개 / 전체 비공개
create or replace function public.set_all_revealed(revealed boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;
  update public.winners set is_revealed = revealed where is_revealed is distinct from revealed;
  insert into public.presentation_events (kind) values (case when revealed then 'reveal_all' else 'hide_all' end);
end;
$$;

-- 관리자: 순서 변경 (한 번에, 원자적으로)
create or replace function public.reorder_winners(ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;
  update public.winners w
     set display_order = o.ord
    from unnest(ids) with ordinality as o(id, ord)
   where w.id = o.id and w.display_order is distinct from o.ord::int;
end;
$$;

revoke execute on function public.reveal_next() from public, anon;
revoke execute on function public.set_all_revealed(boolean) from public, anon;
revoke execute on function public.reorder_winners(uuid[]) from public, anon;
grant execute on function public.reveal_next() to authenticated;
grant execute on function public.set_all_revealed(boolean) to authenticated;
grant execute on function public.reorder_winners(uuid[]) to authenticated;
