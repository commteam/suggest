-- =====================================================================
-- 6) Storage 버킷: 읽기 공개(공개 URL), 쓰기는 관리자만
-- winner-photos: 이미지 5MB / site-audio: 오디오 10MB
--
-- 주의: storage.objects 에 anon SELECT 정책을 만들지 않습니다.
-- 공개 버킷은 정책 없이도 공개 URL 로 파일을 받을 수 있고,
-- SELECT 정책을 열면 버킷 목록 조회(list)로 공개 전 사진 파일명을 알아낼 수 있기 때문입니다.
-- 파일명은 UUID 이며, URL 은 공개된 사람의 것만 get_public_awards 로 내려갑니다.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('winner-photos', 'winner-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('site-audio', 'site-audio', true, 10485760,
    array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "awards storage: 관리자 읽기" on storage.objects;
drop policy if exists "awards storage: 관리자 업로드" on storage.objects;
drop policy if exists "awards storage: 관리자 수정" on storage.objects;
drop policy if exists "awards storage: 관리자 삭제" on storage.objects;

create policy "awards storage: 관리자 읽기" on storage.objects for select to authenticated
  using (bucket_id in ('winner-photos', 'site-audio') and (select public.is_admin()));
create policy "awards storage: 관리자 업로드" on storage.objects for insert to authenticated
  with check (bucket_id in ('winner-photos', 'site-audio') and (select public.is_admin()));
create policy "awards storage: 관리자 수정" on storage.objects for update to authenticated
  using (bucket_id in ('winner-photos', 'site-audio') and (select public.is_admin()))
  with check (bucket_id in ('winner-photos', 'site-audio') and (select public.is_admin()));
create policy "awards storage: 관리자 삭제" on storage.objects for delete to authenticated
  using (bucket_id in ('winner-photos', 'site-audio') and (select public.is_admin()));
