/**
 * Microsoft Teams 안(iframe/웹뷰)에서 열렸는지 판단하는 순수 함수.
 * 일반 브라우저에서는 false 이므로 Teams SDK 를 내려받지도, 초기화하지도 않습니다.
 */

/** Teams 탭을 띄우는 호스트 도메인 (CSP frame-ancestors 와 같은 범위) */
export const TEAMS_HOST_PATTERNS = [
  /^https:\/\/teams\.microsoft\.com$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.teams\.microsoft\.com$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.office\.com$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.microsoft365\.com$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.microsoft\.com$/,
  /^https:\/\/teams\.cloud\.microsoft$/,
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.cloud\.microsoft$/,
];

export function isTeamsOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let o = origin;
  try {
    o = new URL(origin).origin;
  } catch {
    return false;
  }
  return TEAMS_HOST_PATTERNS.some((p) => p.test(o));
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
