import { midiToHz, type MusicEvent } from './score';

export interface SynthKit {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  /** 저사양 기기에서는 겹치는 오실레이터 수를 줄임 */
  rich: boolean;
}

function env(g: GainNode, at: number, dur: number, peak: number, attack: number, release: number) {
  const p = Math.max(peak, 0.0002);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(p, at + attack);
  g.gain.setValueAtTime(p, at + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}

function osc(k: SynthKit, type: OscillatorType, freq: number, detune: number, at: number, dur: number, dest: AudioNode) {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(dest);
  o.start(at);
  o.stop(at + dur + 0.05);
  return o;
}

/** 낮은 현악 패드: 디튠된 톱니파 여러 개 + 부드러운 저역통과 */
function strings(k: SynthKit, e: MusicEvent, at: number) {
  const f = k.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.4;
  f.frequency.setValueAtTime(700 + e.vel * 500, at);
  f.frequency.linearRampToValueAtTime(1000 + e.vel * 1100, at + e.dur * 0.6);
  const g = k.ctx.createGain();
  env(g, at, e.dur, 0.028 * (0.4 + e.vel), 1.1, 1.0);
  f.connect(g).connect(k.out);
  const detunes = k.rich ? [-9, 0, 9] : [-6, 6];
  for (const n of e.notes) for (const d of detunes) osc(k, 'sawtooth', midiToHz(n), d + (Math.random() - 0.5) * 3, at, e.dur, f);
}

function bass(k: SynthKit, e: MusicEvent, at: number) {
  const f = k.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 260;
  const g = k.ctx.createGain();
  env(g, at, e.dur, 0.13 * e.vel, 0.5, 0.9);
  f.connect(g).connect(k.out);
  osc(k, 'triangle', midiToHz(e.notes[0]), 0, at, e.dur, f);
  osc(k, 'sine', midiToHz(e.notes[1] ?? e.notes[0]), 0, at, e.dur, f);
}

/** 브라스풍 화음: 마디 안에서 필터와 음량이 함께 부풀어 오름 */
function brass(k: SynthKit, e: MusicEvent, at: number) {
  const f = k.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(380, at);
  f.frequency.linearRampToValueAtTime(900 + 2300 * e.vel, at + e.dur * 0.55);
  f.frequency.linearRampToValueAtTime(700 + 1200 * e.vel, at + e.dur);
  const g = k.ctx.createGain();
  const peak = 0.05 * e.vel + 0.004;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak * 0.45, at + 0.35);
  g.gain.exponentialRampToValueAtTime(peak, at + e.dur * 0.55);
  g.gain.setValueAtTime(peak, at + e.dur - 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  f.connect(g).connect(k.out);
  for (const n of e.notes) for (const d of k.rich ? [-5, 5] : [0]) osc(k, 'sawtooth', midiToHz(n), d, at, e.dur, f);
}

/** 합창풍 화음: 톱니파 + 비브라토 → 모음 포먼트("아") 대역통과 */
function choir(k: SynthKit, e: MusicEvent, at: number) {
  const g = k.ctx.createGain();
  env(g, at, e.dur, 0.075 * e.vel + 0.003, 1.3, 1.3);
  g.connect(k.out);
  const formants: [number, number, number][] = [
    [730, 9, 1],
    [1090, 11, 0.5],
    [2440, 13, 0.22],
  ];
  const mix = k.ctx.createGain();
  for (const [freq, q, lvl] of formants) {
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const lg = k.ctx.createGain();
    lg.gain.value = lvl;
    mix.connect(bp).connect(lg).connect(g);
  }
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = k.ctx.createGain();
  depth.gain.value = 9;
  lfo.connect(depth);
  lfo.start(at);
  lfo.stop(at + e.dur + 0.05);
  for (const n of e.notes)
    for (const d of k.rich ? [-7, 7] : [0]) {
      const o = osc(k, 'sawtooth', midiToHz(n), d, at, e.dur, mix);
      depth.connect(o.detune);
    }
}

/** 팀파니: 음정이 살짝 떨어지는 사인파 + 타격 잡음 */
function timpani(k: SynthKit, e: MusicEvent, at: number) {
  const f0 = midiToHz(e.notes[0]);
  const o = k.ctx.createOscillator();
  o.frequency.setValueAtTime(f0 * 1.25, at);
  o.frequency.exponentialRampToValueAtTime(f0, at + 0.09);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.55 * e.vel + 0.001, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  o.connect(g).connect(k.out);
  o.start(at);
  o.stop(at + e.dur + 0.05);
  const n = k.ctx.createBufferSource();
  n.buffer = k.noise;
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const ng = k.ctx.createGain();
  ng.gain.setValueAtTime(0.25 * e.vel + 0.001, at);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  n.connect(lp).connect(ng).connect(k.out);
  n.start(at, Math.random(), 0.25);
}

/** 심벌 스웰: 점점 커지는 고역 잡음 (다음 박에서 뚝 끊김) */
function cymbalSwell(k: SynthKit, e: MusicEvent, at: number) {
  const n = k.ctx.createBufferSource();
  n.buffer = k.noise;
  n.loop = true;
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(3500, at);
  hp.frequency.linearRampToValueAtTime(7000, at + e.dur);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.16 * e.vel + 0.001, at + e.dur);
  g.gain.linearRampToValueAtTime(0, at + e.dur + 0.03);
  n.connect(hp).connect(g).connect(k.out);
  n.start(at);
  n.stop(at + e.dur + 0.05);
}

function crash(k: SynthKit, e: MusicEvent, at: number) {
  const n = k.ctx.createBufferSource();
  n.buffer = k.noise;
  n.loop = true;
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4200;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.2 * e.vel, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
  n.connect(hp).connect(g).connect(k.out);
  n.start(at);
  n.stop(at + e.dur + 0.05);
}

const PLAYERS: Record<MusicEvent['inst'], (k: SynthKit, e: MusicEvent, at: number) => void> = {
  strings,
  bass,
  brass,
  choir,
  timpani,
  cymbalSwell,
  crash,
};

export function playEvent(k: SynthKit, e: MusicEvent, at: number) {
  PLAYERS[e.inst](k, e, at);
}
