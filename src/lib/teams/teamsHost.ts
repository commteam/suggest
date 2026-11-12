/**
 * Microsoft Teams 안(iframe/웹뷰)에서 열렸는지 판단하는 순수 함수.
 * 일반 브라우저에서는 false 이므로 Teams SDK 를 내려받지도, 초기화하지도 않습니다.
 */

/**
 * Teams/Microsoft 365 가 탭을 띄우는 호스트.
 * vercel.json·netlify.toml 의 CSP frame-ancestors 와 같은 목록이어야 합니다(단위 테스트로 확인).
 * CSP 와 같은 규칙: "*.도메인" 은 하위 도메인만, 그 외는 정확히 일치.
 */
export const FRAME_ANCESTOR_HOSTS = [
  'teams.microsoft.com',
  '*.teams.microsoft.com',
  '*.skype.com',
  'teams.live.com',
  '*.teams.live.com',
  'teams.cloud.microsoft',
  '*.cloud.microsoft',
  '*.office.com',
  '*.office365.com',
  '*.microsoft365.com',
  '*.microsoft.com',
  '*.sharepoint.com',
  'outlook.office.com',
  'outlook.office365.com',
] as const;

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return host.endsWith('.' + base) && host.length > base.length + 1;
  }
  return host === pattern;
}

export function isTeamsOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '') return false;
  const host = url.hostname.toLowerCase();
  return FRAME_ANCESTOR_HOSTS.some((p) => hostMatches(host, p));
}

export interface HostEnv {
  /** window.self !== window.top */
  inFrame: boolean;
  search: string;
  referrer: string;
  ancestorOrigins: string[];
  userAgent: string;
}

export function readHostEnv(): HostEnv {
  let inFrame: boolean;
  try {
    inFrame = window.self !== window.top;
  } catch {
    inFrame = true; // 교차 출처 top 접근 예외 = iframe 안
  }
  const ao = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  return {
    inFrame,
    search: window.location.search,
    referrer: document.referrer,
    ancestorOrigins: ao ? Array.from(ao) : [],
    userAgent: navigator.userAgent,
  };
}

/** ?source=teams 로 열렸는지 (Teams 앱 매니페스트의 contentUrl 이 붙여 줌) */
export function hasTeamsSourceParam(search: string): boolean {
  return new URLSearchParams(search).get('source') === 'teams';
}

/**
 * Teams 안에서 열렸는지.
 * - Teams 데스크톱/모바일 웹뷰: User-Agent 에 "Teams/" 포함
 * - Teams 웹: Teams 도메인이 부모인 iframe
 * - ?source=teams 이면서 iframe 안
 */
export function isInTeams(env: HostEnv): boolean {
  if (/\bTeams\//.test(env.userAgent)) return true;
  if (!env.inFrame) return false;
  if (env.ancestorOrigins.some(isTeamsOrigin)) return true;
  if (isTeamsOrigin(env.referrer)) return true;
  return hasTeamsSourceParam(env.search);
}
