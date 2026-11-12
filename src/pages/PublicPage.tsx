import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CameraFlash } from '@/components/common/CameraFlash';
import { EmptyState, ErrorState } from '@/components/common/StatusMessage';
import { DetailOverlay } from '@/components/detail/DetailOverlay';
import { Gallery, GallerySkeleton } from '@/components/gallery/Gallery';
import { Confetti } from '@/components/intro/Confetti';
import { EnterButton } from '@/components/intro/EnterButton';
import { GateTitle, Intro } from '@/components/intro/Intro';
import { INSTANT_CONFETTI_SCALE, REVEAL_SEQUENCE } from '@/components/intro/introConfig';
import { BackToGateButton, SkipButton, SoundToggle } from '@/components/intro/IntroControls';
import { RevealSpotlight } from '@/components/presentation/RevealSpotlight';
import { useAccentColor } from '@/hooks/useAccentColor';
import { usePublicSettings, usePublicWinners } from '@/hooks/useAwards';
import { useIntroTimeline } from '@/hooks/useIntroTimeline';
import { SoundProvider } from '@/lib/audio/SoundContext';
import type { MusicSource } from '@/lib/audio/music/MusicPlayer';
import { sound } from '@/lib/audio/SoundEngine';
import type { PresentationEvent, PublicSettings, PublicWinner } from '@/lib/data/types';
import type { IntroCue } from '@/lib/intro/timeline';
import { markOpened, useOpenedSet } from '@/lib/openedStore';

export default function PublicPage() {
  const { settings, error, reload } = usePublicSettings();
  useAccentColor(settings?.accent_color);

  if (!settings) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-bg px-5">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <p role="status" className="animate-pulse text-xs font-light tracking-[0.32em] text-muted uppercase">
            Loading…
          </p>
        )}
      </main>
    );
  }
  return (
    <SoundProvider defaultOn={settings.sound_default}>
      <Stage settings={settings} />
    </SoundProvider>
  );
}

function Stage({ settings }: { settings: PublicSettings }) {
  const reduced = !!useReducedMotion();

  const opened = useOpenedSet();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flash, setFlash] = useState({ key: 0, intensity: 0.85, full: false });
  const [confetti, setConfetti] = useState<{ key: number; scale: number; x: number; palette: 'full' | 'gold'; sides?: boolean }>({
    key: 0,
    scale: 1,
    x: 0.5,
    palette: 'full',
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  // 입장 연출: 오프닝을 끈 예전 설정(intro_enabled=false)은 바로 입장으로 취급
  const mode = settings.intro_enabled === false ? 'instant' : settings.intro_mode;

  // 배경음악: 업로드 음악을 선택했고 파일이 있으면 그것, 아니면 기본 합성 음악
  const musicUrl = settings.music_source === 'upload' && settings.bgm_url ? settings.bgm_url : null;
  const musicSource = useMemo<MusicSource>(() => (musicUrl ? { kind: 'url', url: musicUrl } : { kind: 'synth' }), [musicUrl]);
  useEffect(() => {
    sound.setFanfareUrl(settings.fanfare_url);
  }, [settings.fanfare_url]);
  useEffect(() => {
    sound.setMusicVolume(settings.music_volume);
  }, [settings.music_volume]);
  // 관리자가 음악을 바꾸면 재생 중인 곡도 교체
  useEffect(() => {
    if (sound.musicPlaying) sound.startMusic(musicSource);
  }, [musicSource]);

  // ---- 오프닝 ----
  const onCue = useCallback((cue: IntroCue) => {
    switch (cue.type) {
      case 'drumroll':
        sound.drumroll(cue.durationMs);
        break;
      case 'dot':
        sound.chime(cue.index);
        break;
      case 'flash':
        sound.shutter(cue.intensity);
        setFlash((f) => ({ key: f.key + 1, intensity: cue.intensity, full: false }));
        break;
      case 'finale':
        if (cue.variant === 'cinematic') {
          sound.fanfare();
          setFlash((f) => ({ key: f.key + 1, intensity: 1, full: true }));
          setConfetti((c) => ({ key: c.key + 1, scale: 1, x: 0.5, palette: 'full' }));
        } else if (cue.variant === 'instant') {
          // 커튼이 열릴 때 금색 색종이 한 번 (가볍게)
          setConfetti((c) => ({ key: c.key + 1, scale: INSTANT_CONFETTI_SCALE, x: 0.5, palette: 'gold', sides: true }));
        }
        break;
      case 'gallery':
        sound.introDuckMusic(false);
        break;
    }
  }, []);
  const onCancel = useCallback(() => {
    sound.stopAll(); // 효과음만 정리, 배경음악은 계속
    sound.introDuckMusic(false);
  }, []);
  const intro = useIntroTimeline({
    mode,
    length: settings.intro_length,
    reduced,
    startFinished: false, // 항상 게이트에서 시작 (입장 클릭이 음악 재생의 사용자 제스처)
    onCue,
    onCancel,
  });
  const introState = intro.state;
  const introDone = introState.status === 'done';

  // ---- 발표 모드 수신 ----
  const introDoneRef = useRef(introDone);
  useEffect(() => {
    introDoneRef.current = introDone;
  }, [introDone]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const onPresentation = useCallback((ev: PresentationEvent, list: PublicWinner[]) => {
    if (ev.kind === 'reveal') {
      const w = list.find((x) => x.id === ev.winner_id);
      if (!w || !w.is_revealed) return;
      if (!introDoneRef.current) {
        markOpened(w.id);
        return;
      }
      setCurrentId(null);
      document.querySelector(`[data-frame-id="${w.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(w.id);
      const S = REVEAL_SEQUENCE;
      later(() => {
        setFlash((f) => ({ key: f.key + 1, intensity: 0.95, full: false }));
        sound.shutter(1);
      }, S.spotlightMs);
      later(() => markOpened(w.id), S.spotlightMs + S.flashToPhotoMs);
      later(() => {
        sound.fanfare(true);
        const el = document.querySelector(`[data-frame-id="${w.id}"]`);
        const r = el?.getBoundingClientRect();
        setConfetti((c) => ({
          key: c.key + 1,
          scale: 0.45,
          x: r ? (r.left + r.width / 2) / window.innerWidth : 0.5,
          palette: 'full',
          sides: false,
        }));
      }, S.spotlightMs + S.fanfareDelayMs);
      later(() => setHighlightId((id) => (id === w.id ? null : id)), S.spotlightMs + S.highlightHoldMs);
    } else if (ev.kind === 'reveal_all') {
      const ids = list.filter((x) => x.is_revealed).map((x) => x.id);
      markOpened(...ids);
      if (!introDoneRef.current) return;
      setCurrentId(null);
      setFlash((f) => ({ key: f.key + 1, intensity: 1, full: true }));
      sound.shutter(1);
      sound.fanfare(true);
      setConfetti((c) => ({ key: c.key + 1, scale: 1, x: 0.5, palette: 'full' }));
    } else if (ev.kind === 'hide_all') {
      setCurrentId(null);
    }
  }, []);

  const { state, retry } = usePublicWinners(onPresentation);

  // 입장하기: 누구나 바로 입장 (접속 코드 없음)
  const enter = useCallback(() => {
    // 클릭 제스처 안에서 오디오 잠금 해제 후 바로 재생 (자동재생 차단 회피, 모바일 Safari 포함)
    sound.unlock();
    sound.prepareMusic(musicSource);
    sound.startMusic(musicSource); // 2초 페이드인, 이후 갤러리·상세에서도 계속
    intro.start();
    if (mode === 'cinematic' && !reduced) sound.introDuckMusic(true); // 드럼롤·플래시가 잘 들리도록
  }, [intro, musicSource, mode, reduced]);

  // 처음 화면(게이트)으로 — 음악은 끊지 않음
  const backToGate = useCallback(() => {
    setCurrentId(null);
    intro.reset();
  }, [intro]);

  // 상세 화면을 열면 음악을 40% 로 덕킹
  useEffect(() => {
    sound.duckMusic(!!currentId);
  }, [currentId]);
  useEffect(() => () => sound.duckMusic(false), []);

  // ---- 갤러리/상세 ----
  const winners = state.status === 'ready' ? state.winners : null;
  const open = useCallback((w: PublicWinner) => {
    if (!w.is_revealed) {
      toast('발표 전입니다', { description: '조금만 기다려 주세요. 곧 공개됩니다.' });
      return;
    }
    sound.shutter(0.7);
    setFlash((f) => ({ key: f.key + 1, intensity: 0.85, full: false }));
    markOpened(w.id);
    setCurrentId(w.id);
  }, []);

  let status = null;
  if (state.status === 'loading') status = <GallerySkeleton />;
  else if (state.status === 'error') status = <ErrorState message={state.message} onRetry={retry} />;
  else if (winners && winners.length === 0) status = <EmptyState />;

  const showIntroLayer = !introDone;
  const gate = (
    <>
      <GateTitle title={settings.event_title} subtitle={settings.event_subtitle} year={settings.year} />
      <EnterButton onEnter={enter} />
    </>
  );

  return (
    <main className="relative min-h-[100svh] bg-bg">
      <Gallery
        title={settings.event_title}
        subtitle={settings.event_subtitle}
        year={settings.year}
        winners={winners}
        opened={opened}
        show={introState.galleryIn}
        highlightId={highlightId}
        onOpen={open}
        status={status}
        footer={introDone ? <BackToGateButton onClick={backToGate} /> : null}
      />
      <RevealSpotlight targetId={highlightId} />
      {showIntroLayer && (
        <Intro state={introState} mode={mode} reduced={reduced} introLine={settings.intro_line} gate={gate} />
      )}
      {introState.status === 'running' && mode === 'cinematic' && !reduced && <SkipButton onSkip={intro.skip} />}
      {winners && (
        <DetailOverlay winners={winners} currentId={currentId} onNavigate={open} onClose={() => setCurrentId(null)} />
      )}
      <Confetti burstKey={confetti.key} scale={confetti.scale} originX={confetti.x} palette={confetti.palette} sides={confetti.sides} />
      <CameraFlash flashKey={flash.key} intensity={flash.intensity} full={flash.full} />
      <SoundToggle />
    </main>
  );
}
