import { particleBudget } from '@/lib/perf';
import { playEvent, type SynthKit } from './instruments';
import { buildScore, eventsBetween, type MusicEvent } from './score';
import { DEFAULT_MUSIC_VOLUME, FADE_OUT_SEC, musicTarget, rampSeconds, type MusicLevelState } from './volume';

export type MusicSource = { kind: 'synth' } | { kind: 'url'; url: string };

const LOOKAHEAD = 2.0;
const TICK_MS = 250;

const sameSource = (a: MusicSource | null, b: MusicSource) =>
  !!a && a.kind === b.kind && (a.kind === 'synth' || (b.kind === 'url' && a.url === b.url));

/**
 * 배경음악 재생기.
 * 합성 악보는 룩어헤드 스케줄러로 끊김 없이 반복하고,
 * 업로드한 mp3 는 MediaElementSource 로 같은 음량/덕킹 체인을 거칩니다.
 */
export class MusicPlayer {
  private score: MusicEvent[] = buildScore();
  private level: GainNode;
  private voices: GainNode | null = null;
  private source: MusicSource | null = null;
  private origin = 0;
  private scheduledUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private media: HTMLAudioElement | null = null;
  private state: MusicLevelState = { volume: DEFAULT_MUSIC_VOLUME, enabled: true, ducked: false, introDucked: false };
  private lastApplied: MusicLevelState | null = null;
  private playing = false;

  constructor(
    private ctx: AudioContext,
    output: AudioNode,
    reverbSend: AudioNode,
    private noise: AudioBuffer,
  ) {
    this.level = ctx.createGain();
    this.level.gain.value = 0;
    this.level.connect(output);
    this.level.connect(reverbSend);
  }

  get isPlaying() {
    return this.playing;
  }

  get currentSource() {
    return this.source;
  }

  /**
   * 사용자 제스처 안에서 호출: 업로드 음원이면 미리 재생을 걸어 둬서
   * (모바일 Safari 처럼) 비동기 이후 play() 가 막히는 브라우저에 대비합니다.
   */
  prepare(src: MusicSource) {
    if (this.playing || src.kind !== 'url' || (this.media && sameSource(this.source, src))) return;
    this.teardownVoices();
    this.source = src;
    this.attachMedia(src.url);
  }

  start(src: MusicSource) {
    if (this.playing && sameSource(this.source, src)) {
      this.apply();
      return;
    }
    if (this.playing) this.teardownVoices();
    this.playing = true;
    if (src.kind === 'url') {
      if (!(this.media && sameSource(this.source, src))) this.attachMedia(src.url);
      this.source = src;
      void this.media?.play().catch(() => this.fallbackToSynth());
    } else {
      this.source = src;
      this.startSynth();
    }
    this.lastApplied = null; // 페이드인
    this.apply();
  }

  stop(fade = FADE_OUT_SEC) {
    if (!this.playing && !this.media) return;
    this.playing = false;
    const now = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(now);
    this.level.gain.setValueAtTime(this.level.gain.value, now);
    this.level.gain.linearRampToValueAtTime(0, now + fade);
    const voices = this.voices;
    const media = this.media;
    this.voices = null;
    this.media = null;
    this.stopTimer();
    setTimeout(() => {
      voices?.disconnect();
      media?.pause();
    }, fade * 1000 + 100);
    this.lastApplied = null;
  }

  setVolume(v: number) {
    this.state = { ...this.state, volume: v };
    this.apply();
  }
  setDucked(on: boolean) {
    this.state = { ...this.state, ducked: on };
    this.apply();
  }
  setIntroDucked(on: boolean) {
    this.state = { ...this.state, introDucked: on };
    this.apply();
  }
  setEnabled(on: boolean) {
    this.state = { ...this.state, enabled: on };
    if (on && this.playing && this.source?.kind === 'synth' && !this.timer) this.startSynth();
    if (on && this.playing && this.media?.paused) void this.media.play().catch(() => undefined);
    this.apply();
    if (!on) {
      // 꺼진 동안에는 스케줄링도 멈춰 CPU 를 아낌
      this.stopTimer();
      setTimeout(() => {
        if (!this.state.enabled) {
          this.voices?.disconnect();
          this.voices = null;
          this.media?.pause();
        }
      }, 400);
    }
  }

  /** 탭이 숨겨졌다 돌아올 때 */
  pauseForHidden() {
    this.media?.pause();
  }
  resumeFromHidden() {
    if (this.playing && this.state.enabled) void this.media?.play().catch(() => undefined);
  }

  private apply() {
    const target = this.playing ? musicTarget(this.state) : 0;
    const ramp = rampSeconds(this.lastApplied, this.state);
    const now = this.ctx.currentTime;
    const g = this.level.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + ramp);
    this.lastApplied = { ...this.state };
  }

  private newVoices() {
    this.voices = this.ctx.createGain();
    this.voices.connect(this.level);
    return this.voices;
  }

  private startSynth() {
    const out = this.newVoices();
    this.origin = this.ctx.currentTime + 0.12;
    this.scheduledUntil = 0;
    const kit: SynthKit = { ctx: this.ctx, out, noise: this.noise, rich: particleBudget() >= 0.5 };
    const tick = () => {
      if (!this.voices || this.voices !== out) return;
      const elapsed = this.ctx.currentTime - this.origin;
      const until = Math.max(elapsed, 0) + LOOKAHEAD;
      for (const s of eventsBetween(this.score, this.scheduledUntil, until)) playEvent(kit, s.event, this.origin + s.at);
      this.scheduledUntil = until;
    };
    tick();
    this.stopTimer();
    this.timer = setInterval(tick, TICK_MS);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private attachMedia(url: string) {
    const out = this.newVoices();
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.loop = true;
    el.preload = 'auto';
    el.src = url;
    el.setAttribute('playsinline', '');
    el.addEventListener('error', () => {
      if (this.media === el) this.fallbackToSynth();
    });
    try {
      this.ctx.createMediaElementSource(el).connect(out);
    } catch {
      /* 이미 연결된 요소 등 */
    }
    this.media = el;
    // 제스처 안에서 무음으로 재생을 걸어 둠 (level 이 0 이므로 들리지 않음)
    void el.play().catch(() => undefined);
  }

  /** 업로드 음원을 재생할 수 없으면 기본 합성 음악으로 */
  private fallbackToSynth() {
    if (!this.playing) return;
    this.media?.pause();
    this.media = null;
    this.voices?.disconnect();
    this.source = { kind: 'synth' };
    this.startSynth();
  }

  private teardownVoices() {
    this.stopTimer();
    this.voices?.disconnect();
    this.voices = null;
    this.media?.pause();
    this.media = null;
  }
}
