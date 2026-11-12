/**
 * 배경음악 음량 규칙 (순수 함수, 단위 테스트 대상)
 * - 시작: 2초 페이드인
 * - 상세 화면: 40% 로 덕킹, 닫으면 복귀
 * - 소리 꺼짐/탭 숨김: 0
 */
export const DEFAULT_MUSIC_VOLUME = 0.5;
export const DUCK_RATIO = 0.4;
export const FADE_IN_SEC = 2;
export const DUCK_SEC = 0.6;
export const UNDUCK_SEC = 0.9;
export const FADE_OUT_SEC = 1.2;
/** 시네마틱 오프닝 중에는 효과음이 잘 들리도록 덕킹 */
export const INTRO_DUCK_RATIO = 0.35;

export interface MusicLevelState {
  volume: number;
  enabled: boolean;
  ducked: boolean;
  introDucked?: boolean;
}

export const clampVolume = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_MUSIC_VOLUME);

/** 최종 목표 음량 */
export function musicTarget(s: MusicLevelState): number {
  if (!s.enabled) return 0;
  let v = clampVolume(s.volume);
  if (s.introDucked) v *= INTRO_DUCK_RATIO;
  else if (s.ducked) v *= DUCK_RATIO;
  return v;
}

/** 상태 변화에 맞는 램프 시간 */
export function rampSeconds(prev: MusicLevelState | null, next: MusicLevelState): number {
  if (!prev) return FADE_IN_SEC;
  if (!prev.enabled && next.enabled) return FADE_IN_SEC;
  if (prev.enabled && !next.enabled) return 0.25;
  if (!prev.ducked && next.ducked) return DUCK_SEC;
  if (prev.ducked && !next.ducked) return UNDUCK_SEC;
  if (prev.introDucked !== next.introDucked) return 1.2;
  return 0.3;
}
