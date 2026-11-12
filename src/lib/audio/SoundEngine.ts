import { MusicPlayer, type MusicSource } from './music/MusicPlayer';
import { DEFAULT_MUSIC_VOLUME } from './music/volume';

/**
 * Web Audio API 로 효과음과 배경음악을 합성합니다.
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
  private media = new Set<HTMLAudioElement>();
  private musicPlayer: MusicPlayer | null = null;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private musicDucked = false;
  private musicIntroDucked = false;
  /** 화면 검증용: 자동 시작 상태 */
  autostartState: 'idle' | 'probing' | 'playing' | 'blocked' | 'off' = 'idle';

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
      // 공통 출력: 컴프레서 → 출력
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      comp.connect(this.ctx.destination);
      // 효과음
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.28;
      this.reverb.connect(wet).connect(this.master);
      this.noise = this.makeNoise();
      this.newBus();
      // 배경음악: 드라이 + 홀 리버브(합성 임펄스 3.4초)
      const musicMaster = this.ctx.createGain();
      musicMaster.gain.value = 0.9;
      musicMaster.connect(comp);
      const hall = this.ctx.createConvolver();
      hall.buffer = this.impulse(3.4, 2.4);
      const hallWet = this.ctx.createGain();
      hallWet.gain.value = 0.38;
      hall.connect(hallWet).connect(musicMaster);
      this.musicPlayer = new MusicPlayer(this.ctx, musicMaster, hall, this.noise);
      this.musicPlayer.setVolume(this.musicVolume);
      this.musicPlayer.setDucked(this.musicDucked);
      this.musicPlayer.setIntroDucked(this.musicIntroDucked);
      this.musicPlayer.setEnabled(this.enabled);
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    // 모바일 Safari: 무음 스위치와 관계없이 재생되도록
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        /* 지원 안 함 */
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    this.unlocked = true;
  }

  /**
   * 사용자 조작 없이 소리를 낼 수 있는지 조용히 확인합니다.
   * AudioContext 를 먼저 만들면 차단 환경에서 콘솔 경고가 남으므로,
   * 지원되면 navigator.getAutoplayPolicy 를, 아니면 아주 짧은 무음 오디오의 play() 결과를 씁니다.
   * 차단(NotAllowedError)이나 그 밖의 오류는 false.
   */
  async probeAutoplay(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.unlocked && this.ctx?.state === 'running') return true;
    const nav = navigator as Navigator & { getAutoplayPolicy?: (type: string) => string };
    if (typeof nav.getAutoplayPolicy === 'function') {
      try {
        return nav.getAutoplayPolicy('audiocontext') === 'allowed';
      } catch {
        /* 아래 방식으로 */
      }
    }
    const url = URL.createObjectURL(silentWav());
    const el = new Audio();
    el.preload = 'auto';
    el.src = url;
    // 결과가 늦게 오는 브라우저도 있어 제한 시간 안에 허용되지 않으면 차단으로 보고 안내를 바로 띄움
    const played = el.play().then(
      () => true,
      () => false, // NotAllowedError 등: 조용히 실패
    );
    const ok = await Promise.race([played, new Promise<boolean>((r) => setTimeout(() => r(false), PROBE_TIMEOUT_MS))]);
    const cleanup = () => {
      el.pause();
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    if (ok) cleanup();
    else void played.then(cleanup); // 늦게 끝나도 정리
    return ok;
  }

  private contextRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  /** 실제로 소리가 나는 상태(AudioContext running)가 됐는지 잠시 기다려 확인 */
  async waitRunning(timeoutMs = 400): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, timeoutMs))]);
    return this.contextRunning(); // await 이후 상태는 바뀌었을 수 있으므로 다시 읽음
  }

  /** 탭이 백그라운드로 가면 음악을 멈췄다가 돌아오면 이어서 재생 */
  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      this.musicPlayer?.pauseForHidden();
      void this.ctx.suspend().catch(() => undefined);
    } else if (this.unlocked) {
      void this.ctx.resume().catch(() => undefined);
      this.musicPlayer?.resumeFromHidden();
    }
  };

  // ---------- 배경음악 ----------
  /** 사용자 제스처 안에서 호출 (업로드 음원을 미리 걸어 둠) */
  prepareMusic(src: MusicSource) {
    this.musicPlayer?.prepare(src);
  }
  startMusic(src: MusicSource) {
    if (!this.unlocked) return;
    this.musicPlayer?.start(src);
  }
  stopMusic(fade?: number) {
    this.musicPlayer?.stop(fade);
  }
  get musicPlaying() {
    return !!this.musicPlayer?.isPlaying;
  }
  /** 화면 검증(E2E)용 읽기 전용 상태 — 소리 자체에는 영향 없음 */
  get debugState() {
    return {
      unlocked: this.unlocked,
      enabled: this.enabled,
      contextState: this.ctx?.state ?? 'none',
      musicPlaying: this.musicPlaying,
      musicSource: this.musicPlayer?.currentSource?.kind ?? null,
      autostart: this.autostartState,
      ducked: this.musicDucked,
      introDucked: this.musicIntroDucked,
      volume: this.musicVolume,
    };
  }
  setMusicVolume(v: number) {
    this.musicVolume = v;
    this.musicPlayer?.setVolume(v);
  }
  duckMusic(on: boolean) {
    this.musicDucked = on;
    this.musicPlayer?.setDucked(on);
  }
  introDuckMusic(on: boolean) {
    this.musicIntroDucked = on;
    this.musicPlayer?.setIntroDucked(on);
  }

  /** 음악과 효과음을 함께 켜고 끔 */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
    this.musicPlayer?.setEnabled(on);
  }

  setFanfareUrl(url: string | null) {
    this.fanfareUrl = url;
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

  /** 합성 홀 리버브 임펄스 (지수 감쇠 잡음, 초기 반사 약간) */
  private impulse(seconds: number, decay = 3) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const pre = Math.floor(ctx.sampleRate * 0.02);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
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

  /** 팡파르: 업로드된 mp3 우선, 없으면 합성 금관. short=true 면 음악 위에 얹는 짧은 버전 */
  fanfare(short = false) {
    if (!this.ready) return;
    this.crash(short ? 0.22 : 0.4);
    if (this.fanfareUrl) {
      this.playMedia(this.fanfareUrl, short ? 0.7 : 0.9);
      return;
    }
    if (short) {
      const at = this.ctx!.currentTime + 0.02;
      const n = [523.25, 659.25, 783.99, 1046.5];
      n.forEach((f, i) => this.tone(at + i * 0.09, f, i === 3 ? 1.1 : 0.22, 0.07, 'triangle', 0.01));
      this.tone(at + 0.27, 523.25, 1.1, 0.05, 'triangle', 0.02);
      this.tone(at + 0.27, 659.25, 1.1, 0.04, 'triangle', 0.02);
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

const PROBE_TIMEOUT_MS = 1200;

/** 0.05초 무음 WAV (자동 재생 허용 여부 확인용) */
function silentWav(): Blob {
  const n = 400;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  return new Blob([buf], { type: 'audio/wav' });
}

export const sound = new SoundEngine();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__awardsAudio', { get: () => sound.debugState, configurable: true });
}
