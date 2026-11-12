import { describe, expect, it } from 'vitest';
import { BAR, BARS, buildScore, eventsBetween, LOOP_SECONDS, PROGRESSION, SECTIONS, voice } from './score';

const score = buildScore();

describe('기본 배경음악 악보', () => {
  it('40~60초 길이, 16마디', () => {
    expect(BARS).toBe(16);
    expect(LOOP_SECONDS).toBeGreaterThanOrEqual(40);
    expect(LOOP_SECONDS).toBeLessThanOrEqual(60);
  });

  it('도입 → 고조 → 클라이맥스 → 여운 구조', () => {
    expect(SECTIONS.slice(0, 4).every((s) => s === 'intro')).toBe(true);
    expect(SECTIONS[4]).toBe('build');
    expect(SECTIONS[8]).toBe('climax');
    expect(SECTIONS[15]).toBe('outro');
  });

  it('장조로 시작하고 같은 으뜸화음으로 끝나 자연스럽게 루프', () => {
    expect(PROGRESSION[0].name).toBe('D');
    expect(PROGRESSION.at(-1)?.name).toBe('D');
  });

  it('모든 마디에 현악 패드와 베이스, 이벤트는 루프 안에서 시작', () => {
    for (let bar = 0; bar < BARS; bar++) {
      expect(score.some((e) => e.bar === bar && e.inst === 'strings')).toBe(true);
      expect(score.some((e) => e.bar === bar && e.inst === 'bass')).toBe(true);
    }
    expect(score.every((e) => e.t >= 0 && e.t < LOOP_SECONDS)).toBe(true);
  });

  it('클라이맥스에서 브라스·합창이 최대, 첫 박에 심벌 크래시', () => {
    const climax = score.filter((e) => e.bar >= 8 && e.bar < 12);
    expect(climax.filter((e) => e.inst === 'brass').every((e) => e.vel === 1)).toBe(true);
    expect(climax.filter((e) => e.inst === 'choir').every((e) => e.vel === 1)).toBe(true);
    const crash = score.find((e) => e.inst === 'crash');
    expect(crash?.t).toBeCloseTo(8 * BAR);
  });

  it('심벌 스웰은 클라이맥스 첫 박에서 끝남', () => {
    const swell = score.find((e) => e.inst === 'cymbalSwell' && e.bar === 7)!;
    expect(swell.t + swell.dur).toBeCloseTo(8 * BAR);
  });

  it('브라스는 점점 커짐(고조 구간)', () => {
    const brass = [4, 5, 6, 7].map((b) => score.find((e) => e.bar === b && e.inst === 'brass')!.vel);
    expect([...brass].sort((a, b) => a - b)).toEqual(brass);
  });

  it('화음 쌓기는 화음 구성음만 사용', () => {
    const notes = voice({ name: 'D', root: 38, intervals: [0, 4, 7] }, 52, 4);
    expect(notes).toHaveLength(4);
    expect(notes.every((n) => [2, 6, 9].includes(n % 12))).toBe(true);
  });
});

describe('eventsBetween (시퀀서 스케줄)', () => {
  it('연속 구간으로 나눠도 중복·누락 없음 (루프 경계 포함)', () => {
    const step = 0.25;
    const end = LOOP_SECONDS * 2;
    const collected: string[] = [];
    for (let t = 0; t < end; t += step)
      collected.push(...eventsBetween(score, t, Math.min(t + step, end)).map((s) => `${s.loop}:${s.event.inst}:${s.event.t}:${s.event.notes.join(',')}`));
    expect(collected.length).toBe(score.length * 2);
    expect(new Set(collected).size).toBe(collected.length - countDupEvents() * 2);
  });

  it('두 번째 루프 이벤트는 루프 길이만큼 밀림', () => {
    const second = eventsBetween(score, LOOP_SECONDS, LOOP_SECONDS + 0.01);
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((s) => s.loop === 1 && Math.abs(s.at - LOOP_SECONDS - s.event.t) < 1e-9)).toBe(true);
  });

  it('빈 구간은 빈 결과', () => {
    expect(eventsBetween(score, 5, 5)).toEqual([]);
    expect(eventsBetween(score, 6, 5)).toEqual([]);
  });
});

/** 악보 안에서 완전히 같은 이벤트 수(보정용) */
function countDupEvents() {
  const m = new Map<string, number>();
  for (const e of score) {
    const k = `${e.inst}:${e.t}:${e.notes.join(',')}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.values()].reduce((a, n) => a + (n - 1), 0);
}
