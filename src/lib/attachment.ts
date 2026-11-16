/**
 * 우수자 첨부 파일 공통 규칙.
 * Supabase 버킷(winner-files)의 allowed_mime_types 와 같은 목록을 씁니다
 * (supabase/migrations/20260101000010_winner_attachments.sql).
 * 브라우저마다 hwp 등의 MIME 이 비어 있거나 다르므로, 확장자로 MIME 을 정해서 올립니다.
 */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  hwp: 'application/x-hwp',
  hwpx: 'application/vnd.hancom.hwpx',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
};

/** <input accept> 값 */
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((e) => `.${e}`)
  .join(',');

export const ATTACHMENT_EXT_LABEL = 'PDF, PPT, Word, Excel, 한글(HWP), ZIP, 이미지(PNG·JPG), TXT';

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** 허용된 확장자면 MIME, 아니면 null */
export function attachmentMime(name: string): string | null {
  return ATTACHMENT_TYPES[fileExtension(name)] ?? null;
}

/** 다운로드 이름: 경로 문자 제거, 200자 이내 */
export function cleanAttachmentName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return '첨부파일';
  if (cleaned.length <= 200) return cleaned;
  const ext = fileExtension(cleaned);
  const keep = ext ? 200 - ext.length - 1 : 200;
  return ext ? `${cleaned.slice(0, keep)}.${ext}` : cleaned.slice(0, 200);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/** 첨부 파일 검사. 문제가 있으면 한국어 오류 문구, 괜찮으면 null */
export function validateAttachment(file: { name: string; size: number }, maxBytes: number): string | null {
  if (!attachmentMime(file.name)) return `올릴 수 없는 형식입니다. (${ATTACHMENT_EXT_LABEL})`;
  if (file.size === 0) return '빈 파일은 올릴 수 없습니다.';
  if (file.size > maxBytes) return `${formatBytes(maxBytes)} 이하 파일만 올릴 수 있습니다. (현재 ${formatBytes(file.size)})`;
  return null;
}

export interface AttachmentLink {
  href: string;
  /** <a download> 값. 같은 출처(data/blob URL)에서만 의미가 있음 */
  download?: string;
  /** 다른 출처 URL 은 새 창으로 열어 받음 (Teams 앱 안에서도 외부 브라우저로 받도록) */
  newTab: boolean;
}

/**
 * 다운로드 링크.
 * - data:/blob: (데모 모드): <a download="원래이름">
 * - Supabase 공개 URL: ?download=원래이름 → 서버가 Content-Disposition: attachment 로 원래 이름을 붙여 줌
 *   (다른 출처라 <a download> 의 파일명 지정이 무시되기 때문)
 * - http(s) 가 아닌 주소(javascript: 등)는 null
 */
export function attachmentLink(url: string | null | undefined, name: string | null | undefined): AttachmentLink | null {
  if (!url) return null;
  const fileName = cleanAttachmentName(name || '첨부파일');
  if (url.startsWith('data:') || url.startsWith('blob:')) return { href: url, download: fileName, newTab: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.pathname.includes('/storage/v1/object/public/')) parsed.searchParams.set('download', fileName);
  return { href: parsed.toString(), newTab: true };
}
