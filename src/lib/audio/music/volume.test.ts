import { describe, expect, it } from 'vitest';
import { clampVolume, DUCK_RATIO, FADE_IN_SEC, musicTarget, rampSeconds, UNDUCK_SEC } from './volume';

describe('배경음악 음량 규칙', () => {
  const base = { volume: 0.5, enabled: true, ducked: false };

  it('기본 음량 그대로', () => expect(musicTarget(base)).toBe(0.5));
  it('상세 화면 덕킹은 40%', () => {
    expect(DUCK_RATIO).toBe(0.4);
    expect(musicTarget({ ...base, ducked: true })).toBeCloseTo(0.2);
  });
  it('소리 끄면 0', () => expect(musicTarget({ ...base, enabled: false, ducked: true })).toBe(0));
  it('음량 범위 보정', () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(0.5);
  });
  it('시작은 2초 페이드인, 덕킹 해제는 부드럽게', () => {
    expect(rampSeconds(null, base)).toBe(FADE_IN_SEC);
    expect(FADE_IN_SEC).toBe(2);
    expect(rampSeconds({ ...base, ducked: true }, base)).toBe(UNDUCK_SEC);
    expect(rampSeconds({ ...base, enabled: false }, base)).toBe(FADE_IN_SEC);
  });
  it('오프닝 중 덕킹이 상세 덕킹보다 우선', () => {
    expect(musicTarget({ ...base, ducked: true, introDucked: true })).toBeLessThan(0.2);
  });
});
