import { DOT_COUNT, INSTANT_TIMING, INTRO_TIMING, REDUCED_TIMING, SPOT_LEVEL, type IntroTiming } from '@/components/intro/introConfig';
import type { IntroMode } from '@/lib/data/types';

export type FinaleVariant = 'cinematic' | 'instant' | 'reduced';

export type IntroCue =
  | { at: number; type: 'drumroll'; durationMs: number }
  | { at: number; type: 'spot'; level: number }
  | { at: number; type: 'headline' }
  | { at: number; type: 'dot'; index: number }
  | { at: number; type: 'flash'; intensity: number; index: number }
  | { at: number; type: 'finale'; variant: FinaleVariant }
  | { at: number; type: 'gallery' }
  | { at: number; type: 'done' };

export interface IntroState {
  status: 'idle' | 'running' | 'done';
  spotlight: number;
  headline: boolean;
  dots: number;
  flash: { key: number; intensity: number; full: boolean };
  curtainsOpen: boolean;
  confettiKey: number;
  galleryIn: boolean;
  skipped: boolean;
}

export const INITIAL_INTRO: IntroState = {
  status: 'idle',
  spotlight: SPOT_LEVEL.gate,
  headline: false,
  dots: 0,
  flash: { key: 0, intensity: 0, full: false },
  curtainsOpen: false,
  confettiKey: 0,
  galleryIn: false,
  skipped: false,
};

/** 오프닝을 보지 않고 바로 갤러리를 보여 줄 때의 상태 */
export const FINISHED_INTRO: IntroState = {
  ...INITIAL_INTRO,
  status: 'done',
  spotlight: 0,
  dots: DOT_COUNT,
  curtainsOpen: true,
  galleryIn: true,
};

export interface CueOptions {
  mode: IntroMode;
  length: 'standard' | 'short';
  reduced: boolean;
  timing?: IntroTiming;
}

/** 설정값으로 큐 목록 생성 (시간순 정렬) */
export function buildCues({ mode, length, reduced, timing = INTRO_TIMING[length] }: CueOptions): IntroCue[] {
  if (reduced) {
    return [
      { at: REDUCED_TIMING.finaleAt, type: 'finale', variant: 'reduced' },
      { at: REDUCED_TIMING.galleryAt, type: 'gallery' },
      { at: REDUCED_TIMING.doneAt, type: 'done' },
    ];
  }
  if (mode === 'instant') {
    return [
      { at: INSTANT_TIMING.finaleAt, type: 'finale', variant: 'instant' },
      { at: INSTANT_TIMING.galleryAt, type: 'gallery' },
      { at: INSTANT_TIMING.doneAt, type: 'done' },
    ];
  }
  const t = timing;
  const cues: IntroCue[] = [
    { at: 0, type: 'spot', level: SPOT_LEVEL.dark },
    { at: t.drumrollAt, type: 'drumroll', durationMs: t.finaleAt - t.drumrollAt },
    { at: t.spotRiseAt, type: 'spot', level: SPOT_LEVEL.rising },
    { at: t.headlineAt, type: 'headline' },
    ...Array.from({ length: DOT_COUNT }, (_, i): IntroCue => ({ at: t.dotsAt + i * t.dotInterval, type: 'dot', index: i })),
    ...t.flashes.map((f, i): IntroCue => ({ at: f.at, type: 'flash', intensity: f.intensity, index: i })),
    { at: t.flashes[0]?.at ?? t.finaleAt, type: 'spot', level: SPOT_LEVEL.peak },
    { at: t.finaleAt, type: 'finale', variant: 'cinematic' },
    { at: t.galleryAt, type: 'gallery' },
    { at: t.doneAt, type: 'done' },
  ];
  return cues.sort((a, b) => a.at - b.at);
}

export type IntroAction = { type: 'start' } | { type: 'cue'; cue: IntroCue } | { type: 'finish' } | { type: 'reset' };

export function introReducer(s: IntroState, a: IntroAction): IntroState {
  switch (a.type) {
    case 'reset':
      return { ...INITIAL_INTRO, flash: s.flash, confettiKey: s.confettiKey };
    case 'start':
      return { ...INITIAL_INTRO, status: 'running', flash: s.flash, confettiKey: s.confettiKey };
    case 'finish':
      return { ...FINISHED_INTRO, flash: s.flash, confettiKey: s.confettiKey, skipped: s.status === 'running' };
    case 'cue': {
      if (s.status !== 'running') return s;
      const c = a.cue;
      switch (c.type) {
        case 'spot':
          return { ...s, spotlight: c.level };
        case 'drumroll':
          return s;
        case 'headline':
          return { ...s, headline: true };
        case 'dot':
          return { ...s, dots: Math.max(s.dots, c.index + 1) };
        case 'flash':
          return { ...s, flash: { key: s.flash.key + 1, intensity: c.intensity, full: false } };
        case 'finale':
          if (c.variant === 'reduced') return { ...s, curtainsOpen: true, spotlight: 0 };
          if (c.variant === 'instant') return { ...s, curtainsOpen: true, spotlight: 0, confettiKey: s.confettiKey + 1 };
          return {
            ...s,
            headline: false,
            curtainsOpen: true,
            spotlight: 0,
            flash: { key: s.flash.key + 1, intensity: 1, full: true },
            confettiKey: s.confettiKey + 1,
          };
        case 'gallery':
          return { ...s, galleryIn: true };
        case 'done':
          return { ...s, status: 'done', galleryIn: true, curtainsOpen: true };
      }
    }
  }
  return s;
}

export interface TimerApi {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

const defaultTimers: TimerApi = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** 큐를 예약하고, cancel() 로 대기 중인 모든 타이머를 정리하는 스케줄러 */
export function createScheduler(timers: TimerApi = defaultTimers) {
  const pending = new Set<unknown>();
  return {
    run(cues: IntroCue[], onCue: (c: IntroCue) => void) {
      for (const cue of cues) {
        const id = timers.setTimeout(() => {
          pending.delete(id);
          onCue(cue);
        }, cue.at);
        pending.add(id);
      }
    },
    cancel() {
      pending.forEach((id) => timers.clearTimeout(id));
      pending.clear();
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
