import { safeSessionStorage } from '@/lib/safeStorage';
import { inTeamsContext } from '@/lib/teams/teams';

/** Teams 개인 탭(관리)에서 들어왔는지 이 탭 세션 동안 기억 */
const KEY = 'awards.admin.fromTeams';

export function rememberTeamsEntry() {
  try {
    safeSessionStorage().setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export function cameFromTeams(): boolean {
  try {
    if (safeSessionStorage().getItem(KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return inTeamsContext();
}
