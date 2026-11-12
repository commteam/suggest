/**
 * 기본 배경음악(웅장한 시상식풍) 악보. 외부 음원 없이 Web Audio 로 합성합니다.
 * 이 파일은 순수 데이터/계산만 담아 단위 테스트할 수 있습니다.
 *
 * D 장조, 72 BPM, 4/4, 16마디(약 53초): 도입 4 → 고조 4 → 클라이맥스 4 → 여운 4, 그리고 루프.
 */
export const BPM = 72;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const BARS = 16;
export const LOOP_SECONDS = BAR * BARS;

export type Section = 'intro' | 'build' | 'climax' | 'outro';
export const SECTIONS: Section[] = [
  ...Array<Section>(4).fill('intro'),
  ...Array<Section>(4).fill('build'),
  ...Array<Section>(4).fill('climax'),
  ...Array<Section>(4).fill('outro'),
];

/** 화음: 근음 MIDI(옥타브 2 기준) + 구성음(반음 간격) */
interface Chord {
  name: string;
  root: number;
  intervals: number[];
}
const MAJ = [0, 4, 7];
const MIN = [0, 3, 7];
const D = 38;
const ch = (name: string, rootOffset: number, intervals: number[]): Chord => ({ name, root: D + rootOffset, intervals });

/** 장조 계열의 희망찬 진행 (여운부에 차용화음 Gm 으로 영화적 색채) */
export const PROGRESSION: Chord[] = [
  // 도입
  ch('D', 0, MAJ), ch('Bm', -3, MIN), ch('G', 5, MAJ), ch('A', 7, MAJ),
  // 고조
  ch('D', 0, MAJ), ch('F#m', 4, MIN), ch('G', 5, MAJ), ch('A', 7, MAJ),
  // 클라이맥스
  ch('D', 0, MAJ), ch('A', 7, MAJ), ch('Bm', -3, MIN), ch('G', 5, MAJ),
  // 여운
  ch('D', 0, MAJ), ch('G', 5, MAJ), ch('Gm', 5, MIN), ch('D', 0, MAJ),
];

/** 마디별 악기 세기 (0~1) */
export const DYNAMICS = {
  strings: [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.78, 0.88, 1, 1, 1, 1, 0.8, 0.7, 0.6, 0.5],
  brass: [0, 0, 0, 0.12, 0.25, 0.4, 0.55, 0.75, 1, 1, 1, 1, 0.45, 0.3, 0.2, 0],
  choir: [0, 0, 0, 0, 0, 0, 0.3, 0.5, 1, 1, 1, 1, 0.7, 0.55, 0.45, 0.3],
};

export type Instrument = 'strings' | 'bass' | 'brass' | 'choir' | 'timpani' | 'cymbalSwell' | 'crash';

export interface MusicEvent {
  /** 루프 시작 기준 시각(초) */
  t: number;
  dur: number;
  inst: Instrument;
  /** MIDI 음 */
  notes: number[];
  vel: number;
  bar: number;
}

/** 근음을 기준으로 지정 범위 안에 화음을 쌓음 */
export function voice(chord: Chord, low: number, count: number): number[] {
  const pcs = chord.intervals.map((i) => (chord.root + i) % 12);
  const out: number[] = [];
  for (let n = low; out.length < count && n < low + 36; n++) if (pcs.includes(n % 12)) out.push(n);
  return out;
}

export function buildScore(): MusicEvent[] {
  const ev: MusicEvent[] = [];
  PROGRESSION.forEach((chord, bar) => {
    const t = bar * BAR;
    const s = DYNAMICS.strings[bar];
    const b = DYNAMICS.brass[bar];
    const c = DYNAMICS.choir[bar];
    const legato = BAR + 0.6; // 다음 마디와 겹쳐 끊김 없이

    ev.push({ t, dur: legato, inst: 'bass', notes: [chord.root, chord.root - 12 >= 26 ? chord.root - 12 : chord.root], vel: 0.55 + s * 0.45, bar });
    ev.push({ t, dur: legato, inst: 'strings', notes: [chord.root + 12, ...voice(chord, 52, 4)], vel: s, bar });
    if (b > 0) ev.push({ t, dur: legato, inst: 'brass', notes: voice(chord, 55, 3), vel: b, bar });
    if (c > 0) ev.push({ t, dur: legato, inst: 'choir', notes: voice(chord, 64, 3), vel: c, bar });

    const section = SECTIONS[bar];
    const timp = (beat: number, vel: number, note = chord.root % 12 === 2 ? 38 : 33) =>
      ev.push({ t: t + beat * BEAT, dur: 1.6, inst: 'timpani', notes: [note], vel, bar });

    if (section === 'intro' && bar === 3) timp(0, 0.35);
    if (section === 'build') {
      timp(0, 0.45 + (bar - 4) * 0.1);
      timp(2, 0.35 + (bar - 4) * 0.1);
      if (bar === 7) {
        // 클라이맥스 직전 팀파니 롤 (16분음표, 점점 크게)
        for (let i = 0; i < 8; i++) timp(2 + i * 0.25, 0.4 + i * 0.07, 33);
        ev.push({ t, dur: BAR, inst: 'cymbalSwell', notes: [], vel: 0.9, bar });
      }
    }
    if (section === 'climax') {
      timp(0, 1);
      timp(1, 0.55);
      timp(2, 0.8);
      timp(3, 0.55);
      if (bar === 8) ev.push({ t, dur: 3.5, inst: 'crash', notes: [], vel: 1, bar });
    }
    if (section === 'outro' && bar === 12) timp(0, 0.6);
    if (bar === 15) ev.push({ t: t + BAR / 2, dur: BAR / 2, inst: 'cymbalSwell', notes: [], vel: 0.35, bar });
  });
  return ev.sort((a, b) => a.t - b.t);
}

export interface ScheduledEvent {
  event: MusicEvent;
  /** 절대 재생 시각(초, origin 기준 경과 시간) */
  at: number;
  loop: number;
}

/**
 * [from, to) 구간(재생 시작 후 경과 초)에 시작하는 이벤트를 반복 루프까지 고려해 반환.
 * 연속된 구간으로 나눠 호출해도 중복이나 누락이 없습니다.
 */
export function eventsBetween(score: MusicEvent[], from: number, to: number, loopLen = LOOP_SECONDS): ScheduledEvent[] {
  if (to <= from) return [];
  const out: ScheduledEvent[] = [];
  const firstLoop = Math.max(0, Math.floor(from / loopLen));
  const lastLoop = Math.floor((to - 1e-9) / loopLen);
  for (let k = firstLoop; k <= lastLoop; k++) {
    const base = k * loopLen;
    for (const e of score) {
      const at = base + e.t;
      if (at >= from && at < to) out.push({ event: e, at, loop: k });
    }
  }
  return out;
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
