import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURTAIN_OPEN_MS, DOT_COUNT, INSTANT_TIMING, INTRO_TIMING } from '@/components/intro/introConfig';
import { buildCues, createScheduler, FINISHED_INTRO, INITIAL_INTRO, introReducer, type IntroCue, type IntroState } from './timeline';

const run = (cues: IntroCue[]) =>
  cues.reduce<IntroState>((s, cue) => introReducer(s, { type: 'cue', cue }), introReducer(INITIAL_INTRO, { type: 'start' }));

describe('buildCues — 바로 입장(기본)', () => {
  const cues = buildCues({ mode: 'instant', length: 'standard', reduced: false });

  it('드럼롤·문구·골드 점·플래시 없이 커튼 열림 → 갤러리 → 완료', () => {
    expect(cues.map((c) => c.type)).toEqual(['finale', 'gallery', 'done']);
    expect(cues[0]).toMatchObject({ at: 0, variant: 'instant' });
  });

  it('액자는 커튼이 열리는 동안 떠오르기 시작', () => {
    const gallery = cues.find((c) => c.type === 'gallery')!;
    expect(gallery.at).toBeLessThan(CURTAIN_OPEN_MS.instant);
    expect(CURTAIN_OPEN_MS.instant).toBe(1500);
  });

  it('금색 색종이 한 번, 플래시 없음, 2초 안에 끝남', () => {
    const end = run(cues);
    expect(end.confettiKey).toBe(1);
    expect(end.flash.key).toBe(0);
    expect(end.status).toBe('done');
    expect(INSTANT_TIMING.doneAt).toBeLessThanOrEqual(2000);
  });

  it('reduced-motion 은 모드와 관계없이 짧은 페이드', () => {
    const r = buildCues({ mode: 'instant', length: 'standard', reduced: true });
    expect(r[0]).toMatchObject({ type: 'finale', variant: 'reduced' });
    expect(run(r).confettiKey).toBe(0);
  });
});

describe('buildCues — 시네마틱 오프닝', () => {
  it('표준 오프닝: 요구된 순서대로 진행', () => {
    const cues = buildCues({ mode: 'cinematic', length: 'standard', reduced: false });
    const order = cues.filter((c) => c.type !== 'spot').map((c) => c.type);
    expect(order).toEqual(['drumroll', 'headline', 'dot', 'dot', 'dot', 'dot', 'dot', 'flash', 'flash', 'flash', 'finale', 'gallery', 'done']);
    // 시간순 정렬
    expect(cues.map((c) => c.at)).toEqual([...cues.map((c) => c.at)].sort((a, b) => a - b));
  });

  it('표준 길이는 12~15초', () => {
    const done = buildCues({ mode: 'cinematic', length: 'standard', reduced: false }).find((c) => c.type === 'done')!;
    expect(done.at).toBeGreaterThanOrEqual(12000);
    expect(done.at).toBeLessThanOrEqual(15000);
  });

  it('짧게 모드는 표준보다 짧음', () => {
    const d = (l: 'standard' | 'short') => buildCues({ mode: 'cinematic', length: l, reduced: false }).find((c) => c.type === 'done')!.at;
    expect(d('short')).toBeLessThan(d('standard'));
  });

  it('플래시는 점점 강해짐', () => {
    const flashes = buildCues({ mode: 'cinematic', length: 'standard', reduced: false }).filter((c): c is Extract<IntroCue, { type: 'flash' }> => c.type === 'flash');
    expect(flashes).toHaveLength(3);
    expect(flashes[0].intensity).toBeLessThan(flashes[1].intensity);
    expect(flashes[1].intensity).toBeLessThan(flashes[2].intensity);
  });

  it('드럼롤은 피날레까지 이어짐', () => {
    const cues = buildCues({ mode: 'cinematic', length: 'standard', reduced: false });
    const dr = cues.find((c) => c.type === 'drumroll') as Extract<IntroCue, { type: 'drumroll' }>;
    expect(dr.at + dr.durationMs).toBe(INTRO_TIMING.standard.finaleAt);
  });

  it('reduced-motion: 커튼 열림 + 짧은 페이드만 (플래시/드럼롤 없음)', () => {
    const cues = buildCues({ mode: 'cinematic', length: 'standard', reduced: true });
    expect(cues.map((c) => c.type)).toEqual(['finale', 'gallery', 'done']);
    const end = run(cues);
    expect(end.flash.key).toBe(0);
    expect(end.confettiKey).toBe(0);
    expect(end.curtainsOpen).toBe(true);
  });
});

describe('introReducer', () => {
  it('전체 실행 후 상태', () => {
    const end = run(buildCues({ mode: 'cinematic', length: 'standard', reduced: false }));
    expect(end.status).toBe('done');
    expect(end.dots).toBe(DOT_COUNT);
    expect(end.flash.key).toBe(4); // 3회 + 피날레
    expect(end.flash.full).toBe(true);
    expect(end.confettiKey).toBe(1);
    expect(end.curtainsOpen && end.galleryIn).toBe(true);
  });

  it('건너뛰기(finish)는 즉시 갤러리 상태로', () => {
    let s = introReducer(INITIAL_INTRO, { type: 'start' });
    s = introReducer(s, { type: 'cue', cue: { at: 0, type: 'headline' } });
    s = introReducer(s, { type: 'finish' });
    expect(s).toMatchObject({ ...FINISHED_INTRO, skipped: true });
  });

  it('실행 중이 아닐 때 들어온 큐는 무시', () => {
    const s = introReducer(FINISHED_INTRO, { type: 'cue', cue: { at: 0, type: 'dot', index: 0 } });
    expect(s).toBe(FINISHED_INTRO);
  });
});

describe('createScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('시간에 맞춰 큐 실행', () => {
    const seen: string[] = [];
    const s = createScheduler();
    s.run(buildCues({ mode: 'cinematic', length: 'standard', reduced: false }), (c) => seen.push(c.type));
    vi.advanceTimersByTime(INTRO_TIMING.standard.dotsAt + 1);
    expect(seen).toContain('headline');
    expect(seen.filter((t) => t === 'dot')).toHaveLength(1);
    expect(seen).not.toContain('finale');
    vi.advanceTimersByTime(20000);
    expect(seen.at(-1)).toBe('done');
    expect(s.pendingCount).toBe(0);
  });

  it('cancel() 은 대기 중인 모든 타이머를 정리', () => {
    const seen: string[] = [];
    const s = createScheduler();
    s.run(buildCues({ mode: 'cinematic', length: 'standard', reduced: false }), (c) => seen.push(c.type));
    vi.advanceTimersByTime(2000);
    const before = seen.length;
    expect(s.pendingCount).toBeGreaterThan(0);
    s.cancel();
    expect(s.pendingCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20000);
    expect(seen.length).toBe(before);
  });
});
