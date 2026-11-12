import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRAME_ANCESTOR_HOSTS } from '../lib/teams/teamsHost';

const REQUIRED_ANCESTORS = [
  "'self'",
  'https://teams.microsoft.com',
  'https://*.teams.microsoft.com',
  'https://*.skype.com',
  'https://teams.live.com',
  'https://*.teams.live.com',
  'https://teams.cloud.microsoft',
  'https://*.cloud.microsoft',
  'https://*.office.com',
  'https://*.office365.com',
  'https://*.microsoft365.com',
  'https://*.microsoft.com',
  'https://*.sharepoint.com',
  'https://outlook.office.com',
  'https://outlook.office365.com',
];

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

  it('frame-ancestors 에 필요한 Teams/Microsoft 호스트가 모두 있음', () => {
    const fa = directive('frame-ancestors');
    for (const d of REQUIRED_ANCESTORS) expect(fa).toContain(d);
  });

  it('다른 일반 사이트는 삽입 불가 (전체 허용·http·비 Microsoft 도메인 없음)', () => {
    const fa = directive('frame-ancestors');
    expect(fa).not.toContain('*');
    expect(fa).not.toContain('https:');
    expect(fa).not.toContain('http:');
    const MS = /^https:\/\/(\*\.)?([a-z0-9-]+\.)*(microsoft\.com|office\.com|office365\.com|microsoft365\.com|cloud\.microsoft|skype\.com|live\.com|sharepoint\.com)$/;
    for (const d of fa) expect(d === "'self'" || MS.test(d), d).toBe(true);
    // live.com 은 teams.live.com 계열만
    expect(fa.filter((d) => d.includes('live.com')).every((d) => /teams\.live\.com$/.test(d))).toBe(true);
  });

  it('앱의 Teams 감지 목록 = CSP frame-ancestors 목록', () => {
    const fa = directive('frame-ancestors').filter((d) => d !== "'self'").map((d) => d.replace('https://', ''));
    expect([...FRAME_ANCESTOR_HOSTS].sort()).toEqual([...fa].sort());
  });

  it('Teams SDK 요청 경로가 막히지 않음', () => {
    // SDK 는 신뢰 도메인 목록을 이 주소에서 fetch 하고, 스크립트·iframe 은 만들지 않음(번들 포함)
    expect(directive('connect-src')).toContain('https://res.cdn.office.net');
    expect(directive('script-src')).toEqual(["'self'"]);
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
