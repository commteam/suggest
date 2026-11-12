-- =====================================================================
-- 1) 확장, 역할 테이블, 관리자 판별 함수
-- 관리자 판별은 이 테이블로만 합니다. 클라이언트가 보낸 값은 신뢰하지 않습니다.
-- =====================================================================
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('admin');
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- 본인 행만 읽기. 쓰기 정책 없음 → 클라이언트(anon/authenticated)는 쓸 수 없음.
drop policy if exists "user_roles: 본인 행 읽기" on public.user_roles;
create policy "user_roles: 본인 행 읽기" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_roles from anon;
revoke insert, update, delete, truncate on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;

-- has_role: RLS 정책 안에서 user_roles 를 조회하기 위한 SECURITY DEFINER 함수
create or replace function public.has_role(uid uuid, r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = uid and ur.role = r
  );
$$;

-- 현재 로그인 사용자가 관리자인지
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
