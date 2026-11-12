/**
 * Web Audio API 로 효과음을 합성합니다.
 * - 사용자 클릭(unlock) 이전에는 어떤 소리도 재생하지 않습니다.
 * - 관리자가 올린 팡파르/배경음 mp3 가 있으면 그것을 우선 사용합니다.
 * - stopAll() 은 진행 중인 모든 소리를 즉시 정리합니다(건너뛰기).
 */
type Ctx = AudioContext;

const CHIME_FREQS = [1046.5, 1318.5, 1568, 1760, 2093];

export class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private unlocked = false;
  private fanfareUrl: string | null = null;
  private bgmUrl: string | null = null;
  private media = new Set<HTMLAudioElement>();
  private bgm: HTMLAudioElement | null = null;
  private wantBgm = false;

  get isUnlocked() {
    return this.unlocked;
  }

  /** 반드시 사용자 제스처(클릭) 핸들러 안에서 호출 */
  unlock() {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.28;
      this.reverb.connect(wet).connect(this.master);
      this.noise = this.makeNoise();
      this.newBus();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    this.unlocked = true;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.stopAll();
      this.stopBgm();
    } else if (this.wantBgm) this.startBgm();
  }

  setCustomAudio(fanfareUrl: string | null, bgmUrl: string | null) {
    this.fanfareUrl = fanfareUrl;
    if (bgmUrl !== this.bgmUrl) {
      this.stopBgm();
      this.bgmUrl = bgmUrl;
      if (this.wantBgm) this.startBgm();
    }
  }

  private get ready() {
    return this.enabled && this.unlocked && !!this.ctx && !!this.bus;
  }

  private newBus() {
    if (!this.ctx || !this.master || !this.reverb) return;
    this.bus = this.ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(this.reverb);
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  private noiseHit(at: number, opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(opts.gain, 0.0002), at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(at, Math.random() * 1.5, opts.dur + 0.05);
  }

  private tone(at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.bus!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** 점점 빨라지는 스네어 드럼롤 + 낮은 울림 */
  drumroll(durationMs: number) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const start = ctx.currentTime + 0.02;
    const dur = durationMs / 1000;
    let t = 0;
    while (t < dur) {
      const p = t / dur;
      const rate = 7 + 30 * Math.pow(p, 1.5);
      const level = 0.07 + 0.38 * Math.pow(p, 1.3);
      this.noiseHit(start + t, { dur: 0.09, gain: level * (0.85 + Math.random() * 0.3), type: 'bandpass', freq: 1900, q: 0.7 });
      t += 1 / rate;
    }
    // 바닥 울림
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.5, start + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.25);
    src.connect(lp).connect(g).connect(this.bus!);
    src.start(start);
    src.stop(start + dur + 0.3);
  }

  /** 골드 점 차임 (점마다 음이 올라감) */
  chime(index: number) {
    if (!this.ready) return;
    const at = this.ctx!.currentTime + 0.01;
    const f = CHIME_FREQS[index % CHIME_FREQS.length];
    this.tone(at, f, 1.8, 0.22);
    this.tone(at, f * 2.76, 0.9, 0.06);
    this.tone(at, f * 5.4, 0.35, 0.025);
  }

  /** 카메라 셔터 */
  shutter(intensity = 0.8) {
    if (!this.ready) return;
    const at = this.ctx!.currentTime + 0.005;
    const k = 0.35 + intensity * 0.5;
    this.noiseHit(at, { dur: 0.025, gain: 0.5 * k, type: 'highpass', freq: 3200 });
    this.noiseHit(at + 0.004, { dur: 0.05, gain: 0.25 * k, type: 'lowpass', freq: 600 });
    this.noiseHit(at + 0.075, { dur: 0.03, gain: 0.38 * k, type: 'highpass', freq: 2600 });
    // 플래시 충전음
    this.tone(at + 0.09, 3600, 0.25, 0.012 * k, 'sine', 0.02);
  }

  /** 심벌 크래시 */
  crash(gain = 0.45) {
    if (!this.ready) return;
    const at = this.ctx!.currentTime + 0.005;
    this.noiseHit(at, { dur: 2.6, gain, type: 'highpass', freq: 4500, q: 0.3 });
    this.noiseHit(at, { dur: 0.6, gain: gain * 0.6, type: 'bandpass', freq: 7000, q: 0.5 });
  }

  /** 팡파르: 업로드된 mp3 우선, 없으면 합성 금관 */
  fanfare() {
    if (!this.ready) return;
    this.crash(0.4);
    if (this.fanfareUrl) {
      this.playMedia(this.fanfareUrl, 0.9);
      return;
    }
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.03;
    const brass = (t: number, freq: number, dur: number, gain: number) => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(3200, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(1400, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
      g.gain.setValueAtTime(gain, t + Math.max(0.05, dur - 0.12));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      f.connect(g).connect(this.bus!);
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    };
    const timpani = (t: number, gain: number) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.bus!);
      o.start(t);
      o.stop(t + 1);
    };
    const n = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C4: 261.63, E4: 329.63, G3: 196 };
    timpani(at, 0.6);
    brass(at, n.G4, 0.17, 0.16);
    brass(at + 0.18, n.C5, 0.17, 0.16);
    brass(at + 0.36, n.E5, 0.17, 0.16);
    brass(at + 0.54, n.G5, 0.5, 0.18);
    brass(at + 1.1, n.E5, 0.18, 0.15);
    timpani(at + 1.3, 0.7);
    brass(at + 1.3, n.G5, 2.2, 0.17);
    brass(at + 1.3, n.C5, 2.2, 0.12);
    brass(at + 1.3, n.E4, 2.2, 0.1);
    brass(at + 1.3, n.C4, 2.2, 0.1);
    brass(at + 1.3, n.G3, 2.2, 0.08);
  }

  private playMedia(url: string, volume: number, loop = false) {
    const a = new Audio(url);
    a.volume = volume;
    a.loop = loop;
    this.media.add(a);
    a.addEventListener('ended', () => this.media.delete(a));
    void a.play().catch(() => this.media.delete(a));
    return a;
  }

  /** 갤러리 배경음 (업로드된 경우에만) */
  startBgm() {
    this.wantBgm = true;
    if (!this.ready || !this.bgmUrl || this.bgm) return;
    this.bgm = new Audio(this.bgmUrl);
    this.bgm.loop = true;
    this.bgm.volume = 0.3;
    void this.bgm.play().catch(() => {
      this.bgm = null;
    });
  }

  stopBgm(forget = false) {
    if (forget) this.wantBgm = false;
    this.bgm?.pause();
    this.bgm = null;
  }

  /** 진행 중/예약된 모든 효과음 즉시 정리 */
  stopAll() {
    this.media.forEach((a) => a.pause());
    this.media.clear();
    if (this.ctx && this.bus) {
      const old = this.bus;
      const now = this.ctx.currentTime;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.04);
      setTimeout(() => old.disconnect(), 80);
      this.newBus();
    }
  }
}

export const sound = new SoundEngine();
