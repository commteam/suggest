import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const all = vercel.headers.find((h) => h.source === '/(.*)')!.headers;
const csp = all.find((h) => h.key === 'Content-Security-Policy')!.value;
const directive = (name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(name + ' '))
    ?.split(/\s+/)
    .slice(1) ?? [];

describe('배포 보안 헤더 (Teams 개인 탭)', () => {
  it('X-Frame-Options 는 없음 (CSP frame-ancestors 로 대체)', () => {
    expect(all.some((h) => h.key.toLowerCase() === 'x-frame-options')).toBe(false);
    expect(netlify).not.toMatch(/X-Frame-Options\s*=/);
  });

  it('frame-ancestors 는 self + Teams/Microsoft 365 도메인만', () => {
    const fa = directive('frame-ancestors');
    for (const d of [
      "'self'",
      'https://teams.microsoft.com',
      'https://*.teams.microsoft.com',
      'https://*.office.com',
      'https://*.microsoft365.com',
      'https://*.microsoft.com',
    ])
      expect(fa).toContain(d);
    expect(fa).not.toContain('*');
    expect(fa.every((d) => d === "'self'" || /^https:\/\/([*a-z0-9-]+\.)*(microsoft\.com|office\.com|microsoft365\.com|cloud\.microsoft)$/.test(d))).toBe(true);
  });

  it('앱 동작에 필요한 출처 허용 (Supabase, 폰트, data/blob 이미지·오디오)', () => {
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(directive('connect-src')).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']));
    expect(directive('img-src')).toEqual(expect.arrayContaining(['data:', 'blob:', 'https://*.supabase.co']));
    expect(directive('media-src')).toEqual(expect.arrayContaining(['data:', 'blob:', 'https://*.supabase.co']));
    expect(directive('font-src')).toEqual(expect.arrayContaining(["'self'"]));
    expect(directive('object-src')).toEqual(["'none'"]);
  });

  it('기존 보안 헤더 유지', () => {
    expect(all.find((h) => h.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
    expect(all.find((h) => h.key === 'Referrer-Policy')?.value).toBe('strict-origin-when-cross-origin');
  });

  it('Netlify 와 Vercel 의 CSP 가 같음', () => {
    expect(netlify).toContain(`Content-Security-Policy = "${csp}"`);
  });
});
