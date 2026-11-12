-- =====================================================================
-- 3) 사이트 설정(단일 행) + 접속 코드
-- access_code_hash 는 공개 읽기에서 제외합니다.
-- =====================================================================
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  event_title text not null default '2026 SUGGESTION AWARDS' check (char_length(event_title) between 1 and 120),
  event_subtitle text not null default '사내 제안제도 수행 우수자 발표' check (char_length(event_subtitle) <= 200),
  year int not null default 2026 check (year between 2000 and 2100),
  intro_line text not null default '2026 제안제도 우수 수행자를 소개합니다' check (char_length(intro_line) <= 200),
  intro_enabled boolean not null default true,
  intro_length text not null default 'standard' check (intro_length in ('standard', 'short')),
  sound_default boolean not null default true,
  accent_color text not null default '#d9b45a' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  fanfare_url text check (fanfare_url is null or char_length(fanfare_url) <= 1000),
  bgm_url text check (bgm_url is null or char_length(bgm_url) <= 1000),
  access_code_hash text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings: 관리자 읽기" on public.site_settings;
drop policy if exists "site_settings: 관리자 수정" on public.site_settings;
create policy "site_settings: 관리자 읽기" on public.site_settings for select to authenticated using ((select public.is_admin()));
create policy "site_settings: 관리자 수정" on public.site_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- access_code_hash 컬럼은 관리자라도 직접 읽거나 쓸 수 없게 컬럼 단위로만 권한 부여
-- (해시 변경은 set_access_code(), 설정 여부는 get_public_settings() 로)
revoke all on public.site_settings from anon, authenticated;
grant select (id, event_title, event_subtitle, year, intro_line, intro_enabled, intro_length,
              sound_default, accent_color, fanfare_url, bgm_url, updated_at)
  on public.site_settings to authenticated;
grant update (event_title, event_subtitle, year, intro_line, intro_enabled, intro_length,
              sound_default, accent_color, fanfare_url, bgm_url)
  on public.site_settings to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- 공개 설정 (해시 제외, 코드 설정 여부만)
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
    'sound_default', s.sound_default,
    'accent_color', s.accent_color,
    'fanfare_url', s.fanfare_url,
    'bgm_url', s.bgm_url,
    'access_code_set', s.access_code_hash is not null
  )
  from public.site_settings s
  where s.id = 1;
$$;

-- 접속 코드 확인 (true/false)
create or replace function public.verify_access_code(code text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h text;
begin
  select access_code_hash into h from public.site_settings where id = 1;
  if h is null or code is null or char_length(code) = 0 or char_length(code) > 200 then
    return false;
  end if;
  return extensions.crypt(code, h) = h;
end;
$$;

-- 관리자: 접속 코드 설정/변경 (bcrypt 해시로만 저장)
create or replace function public.set_access_code(code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 접속 코드를 바꿀 수 있습니다.' using errcode = 'insufficient_privilege';
  end if;
  if code is null or char_length(btrim(code)) < 6 or char_length(code) > 64 then
    raise exception '접속 코드는 6~64자여야 합니다.' using errcode = 'check_violation';
  end if;
  update public.site_settings
     set access_code_hash = extensions.crypt(btrim(code), extensions.gen_salt('bf', 10))
   where id = 1;
end;
$$;

revoke execute on function public.get_public_settings() from public;
revoke execute on function public.verify_access_code(text) from public;
revoke execute on function public.set_access_code(text) from public, anon;
grant execute on function public.get_public_settings() to anon, authenticated;
grant execute on function public.verify_access_code(text) to anon, authenticated;
grant execute on function public.set_access_code(text) to authenticated;
