import { describe, expect, it } from 'vitest';
import { attachmentLink, attachmentMime, cleanAttachmentName, validateAttachment } from './attachment';

describe('첨부 파일 규칙', () => {
  it('확장자로 MIME 결정 (대소문자 무관), 허용 안 된 형식은 null', () => {
    expect(attachmentMime('보고서.PDF')).toBe('application/pdf');
    expect(attachmentMime('발표.pptx')).toContain('presentationml');
    expect(attachmentMime('문서.hwp')).toBe('application/x-hwp');
    expect(attachmentMime('page.html')).toBeNull();
    expect(attachmentMime('noext')).toBeNull();
  });

  it('형식·빈 파일·용량 검사', () => {
    expect(validateAttachment({ name: 'a.pdf', size: 10 }, 100)).toBeNull();
    expect(validateAttachment({ name: 'a.exe', size: 10 }, 100)).toContain('형식');
    expect(validateAttachment({ name: 'a.pdf', size: 0 }, 100)).toContain('빈 파일');
    expect(validateAttachment({ name: 'a.pdf', size: 101 }, 100)).toContain('이하');
  });

  it('파일 이름 정리: 경로·제어문자 제거, 200자 제한(확장자 유지)', () => {
    expect(cleanAttachmentName('C:\\\\temp\\\\보고서.pdf')).toBe('보고서.pdf');
    expect(cleanAttachmentName('a\u0000b.pdf')).toBe('ab.pdf');
    const long = cleanAttachmentName(`${'가'.repeat(300)}.pptx`);
    expect(long).toHaveLength(200);
    expect(long.endsWith('.pptx')).toBe(true);
    expect(cleanAttachmentName('   ')).toBe('첨부파일');
  });

  it('Supabase 공개 URL 은 ?download=원래이름 을 붙여 새 창으로', () => {
    const l = attachmentLink('https://x.supabase.co/storage/v1/object/public/winner-files/u.pdf', '추진 보고서.pdf')!;
    expect(l.newTab).toBe(true);
    expect(new URL(l.href).searchParams.get('download')).toBe('추진 보고서.pdf');
  });

  it('데모(data URL)는 download 속성으로, 주소 없거나 위험한 주소는 null', () => {
    expect(attachmentLink('data:application/pdf;base64,AAAA', 'a.pdf')).toEqual({
      href: 'data:application/pdf;base64,AAAA',
      download: 'a.pdf',
      newTab: false,
    });
    expect(attachmentLink(null, 'a.pdf')).toBeNull();
    expect(attachmentLink('javascript:alert(1)', 'a.pdf')).toBeNull();
  });

});
