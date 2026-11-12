import { isInTeams, readHostEnv } from './teamsHost';

export type TeamsStatus = 'not-teams' | 'initializing' | 'ready' | 'failed' | 'timeout';

const TIMEOUT_MS = 6000;
let status: TeamsStatus = 'not-teams';
let started = false;

export const teamsStatus = () => status;

/** 이 브라우저 탭에서 Teams 로 판단했는지 (로그인 안내 등 UI 용) */
export function inTeamsContext(): boolean {
  try {
    return isInTeams(readHostEnv());
  } catch {
    return false;
  }
}

/**
 * Teams 안에서 열렸을 때만 SDK 를 동적으로 불러와 초기화하고 로딩 완료를 알립니다.
 * - Teams 밖: 아무것도 하지 않음(SDK 도 내려받지 않음)
 * - 실패/타임아웃: 화면은 그대로 동작, 상태만 기록
 */
export async function initTeamsIfEmbedded(): Promise<TeamsStatus> {
  if (started) return status;
  started = true;
  if (!inTeamsContext()) return (status = 'not-teams');
  status = 'initializing';
  try {
    const { app } = await import('@microsoft/teams-js');
    const result = await Promise.race([
      app.initialize().then(() => 'ok' as const),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), TIMEOUT_MS)),
    ]);
    if (result === 'timeout') return (status = 'timeout');
    try {
      app.notifyAppLoaded();
    } catch {
      /* 일부 호스트는 지원 안 함 */
    }
    app.notifySuccess();
    return (status = 'ready');
  } catch {
    return (status = 'failed');
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__awardsTeams', { get: () => status, configurable: true });
}
