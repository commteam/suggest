-- =====================================================================
-- 2) 우수자 테이블 (한 사람당 제안 주제 1개, proposals 테이블 없음)
-- 공개 사용자는 이 테이블을 직접 읽을 수 없습니다.
-- 공개 화면은 get_public_awards(code) 함수로만 읽습니다(04 참고).
-- =====================================================================
create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  display_order int not null default 0 check (display_order between 0 and 1000),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  dept text not null default '' check (char_length(dept) <= 100),
  position text check (position is null or char_length(position) <= 50),
  photo_url text check (photo_url is null or char_length(photo_url) <= 1000),
  topic text not null default '' check (char_length(topic) <= 200),
  as_is text not null default '' check (char_length(as_is) <= 4000),
  actions text not null default '' check (char_length(actions) <= 4000),
  to_be text not null default '' check (char_length(to_be) <= 4000),
  reflection text not null default '' check (char_length(reflection) <= 4000),
  is_revealed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists winners_display_order_idx on public.winners (display_order, created_at);

alter table public.winners enable row level security;

drop policy if exists "winners: 관리자 읽기" on public.winners;
drop policy if exists "winners: 관리자 추가" on public.winners;
drop policy if exists "winners: 관리자 수정" on public.winners;
drop policy if exists "winners: 관리자 삭제" on public.winners;
create policy "winners: 관리자 읽기" on public.winners for select to authenticated using ((select public.is_admin()));
create policy "winners: 관리자 추가" on public.winners for insert to authenticated with check ((select public.is_admin()));
create policy "winners: 관리자 수정" on public.winners for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "winners: 관리자 삭제" on public.winners for delete to authenticated using ((select public.is_admin()));

revoke all on public.winners from anon;
grant select, insert, update, delete on public.winners to authenticated;

-- 최대 10명
create or replace function public.enforce_max_winners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.winners) > 10 then
    raise exception '우수자는 최대 10명까지 등록할 수 있습니다.' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists winners_max_10 on public.winners;
create trigger winners_max_10
  after insert on public.winners
  for each statement execute function public.enforce_max_winners();
