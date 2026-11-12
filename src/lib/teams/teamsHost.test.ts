import { describe, expect, it } from 'vitest';
import { hasTeamsSourceParam, isInTeams, isTeamsOrigin, type HostEnv } from './teamsHost';

const browser: HostEnv = { inFrame: false, search: '', referrer: '', ancestorOrigins: [], userAgent: 'Mozilla/5.0 Chrome/130' };

describe('Teams 호스트 감지', () => {
  it('일반 브라우저(최상위 창)는 Teams 아님 — ?source=teams 여도', () => {
    expect(isInTeams(browser)).toBe(false);
    expect(isInTeams({ ...browser, search: '?source=teams' })).toBe(false);
  });

  it('Teams 도메인이 부모인 iframe', () => {
    expect(isInTeams({ ...browser, inFrame: true, ancestorOrigins: ['https://teams.microsoft.com'] })).toBe(true);
    expect(isInTeams({ ...browser, inFrame: true, referrer: 'https://teams.cloud.microsoft/' })).toBe(true);
  });

  it('다른 사이트가 iframe 으로 넣은 경우는 Teams 아님', () => {
    expect(isInTeams({ ...browser, inFrame: true, ancestorOrigins: ['https://evil.example.com'] })).toBe(false);
    expect(isInTeams({ ...browser, inFrame: true, referrer: 'https://microsoft.com.evil.example/' })).toBe(false);
  });

  it('Teams 데스크톱/모바일 웹뷰 User-Agent', () => {
    expect(isInTeams({ ...browser, userAgent: 'Mozilla/5.0 Teams/24215.1007.3082.1590/49' })).toBe(true);
  });

  it('iframe + ?source=teams', () => {
    expect(isInTeams({ ...browser, inFrame: true, search: '?source=teams' })).toBe(true);
    expect(hasTeamsSourceParam('?x=1&source=teams')).toBe(true);
  });

  it('도메인 판정은 정확히 (접미사 속임 방지)', () => {
    expect(isTeamsOrigin('https://teams.microsoft.com')).toBe(true);
    expect(isTeamsOrigin('https://outlook.office.com')).toBe(true);
    expect(isTeamsOrigin('https://www.microsoft365.com')).toBe(true);
    expect(isTeamsOrigin('http://teams.microsoft.com')).toBe(false);
    expect(isTeamsOrigin('https://teams.microsoft.com.evil.io')).toBe(false);
    expect(isTeamsOrigin('https://evilmicrosoft.com')).toBe(false);
    expect(isTeamsOrigin('not a url')).toBe(false);
  });
});
