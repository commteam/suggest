import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CameraFlash } from '@/components/common/CameraFlash';
import { EmptyState, ErrorState } from '@/components/common/StatusMessage';
import { DetailOverlay } from '@/components/detail/DetailOverlay';
import { AccessGate } from '@/components/gate/AccessGate';
import { Gallery, GallerySkeleton } from '@/components/gallery/Gallery';
import { Confetti } from '@/components/intro/Confetti';
import { GateTitle, Intro } from '@/components/intro/Intro';
import { REVEAL_SEQUENCE } from '@/components/intro/introConfig';
import { ReplayButton, SkipButton, SoundToggle } from '@/components/intro/IntroControls';
import { RevealSpotlight } from '@/components/presentation/RevealSpotlight';
import { useAccentColor } from '@/hooks/useAccentColor';
import { usePublicSettings, usePublicWinners } from '@/hooks/useAwards';
import { useIntroTimeline } from '@/hooks/useIntroTimeline';
import { introSeen, markIntroSeen, readStoredCode, storeCode } from '@/lib/accessCode';
import { SoundProvider } from '@/lib/audio/SoundContext';
import { sound } from '@/lib/audio/SoundEngine';
import { provider } from '@/lib/data/provider';
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
          <p role="status" className="animate-pulse font-display text-xl text-muted italic">
            Loading…
          </p>
        )}
      </main>
    );
  }
  return (
    <SoundProvider defaultOn={settings.sound_default}>
      <Stage settings={settings} onRecheck={reload} />
    </SoundProvider>
  );
}

function Stage({ settings, onRecheck }: { settings: PublicSettings; onRecheck: () => void }) {
  const reduced = !!useReducedMotion();
  const [code, setCode] = useState<string | null>(() => (settings.gate === 'code' ? readStoredCode() : null));
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const granted = settings.gate === 'open' || (settings.gate === 'code' && !!code);

  const opened = useOpenedSet();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flash, setFlash] = useState({ key: 0, intensity: 0.85, full: false });
  const [confetti, setConfetti] = useState({ key: 0, scale: 1, x: 0.5 });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    sound.setCustomAudio(settings.fanfare_url, settings.bgm_url);
  }, [settings.fanfare_url, settings.bgm_url]);

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
        sound.fanfare();
        if (!cue.reduced) {
          setFlash((f) => ({ key: f.key + 1, intensity: 1, full: true }));
          setConfetti((c) => ({ key: c.key + 1, scale: 1, x: 0.5 }));
        }
        break;
      case 'gallery':
        sound.startBgm();
        break;
    }
  }, []);
  const onCancel = useCallback(() => sound.stopAll(), []);
  const intro = useIntroTimeline({
    length: settings.intro_length,
    reduced,
    startFinished: granted && (introSeen() || !settings.intro_enabled),
    onCue,
    onCancel,
    onDone: markIntroSeen,
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
        sound.fanfare();
        const el = document.querySelector(`[data-frame-id="${w.id}"]`);
        const r = el?.getBoundingClientRect();
        setConfetti((c) => ({ key: c.key + 1, scale: 0.45, x: r ? (r.left + r.width / 2) / window.innerWidth : 0.5 }));
      }, S.spotlightMs + S.fanfareDelayMs);
      later(() => setHighlightId((id) => (id === w.id ? null : id)), S.spotlightMs + S.highlightHoldMs);
    } else if (ev.kind === 'reveal_all') {
      const ids = list.filter((x) => x.is_revealed).map((x) => x.id);
      markOpened(...ids);
      if (!introDoneRef.current) return;
      setCurrentId(null);
      setFlash((f) => ({ key: f.key + 1, intensity: 1, full: true }));
      sound.shutter(1);
      sound.fanfare();
      setConfetti((c) => ({ key: c.key + 1, scale: 1, x: 0.5 }));
    } else if (ev.kind === 'hide_all') {
      setCurrentId(null);
    }
  }, []);

  // 접속 코드가 바뀌었거나 틀린 경우 → 게이트로
  const resetIntro = intro.reset;
  const onDenied = useCallback(() => {
    storeCode(null);
    setCode(null);
    setGateNotice('접속 코드가 변경되었습니다. 새 코드를 입력해 주세요.');
    resetIntro();
    onRecheck(); // 코드가 해제된 경우 "준비 중" 으로 전환
  }, [resetIntro, onRecheck]);

  const { state, retry } = usePublicWinners(settings.gate === 'code' ? code : null, granted, onPresentation, onDenied);

  const enter = useCallback(
    async (input: string | null): Promise<string | null> => {
      sound.unlock(); // 클릭 제스처 안에서 오디오 잠금 해제
      if (settings.gate === 'code' && !code) {
        try {
          const ok = await provider.verifyAccessCode(input ?? '');
          if (!ok) return '접속 코드가 올바르지 않습니다.';
        } catch (e) {
          return e instanceof Error ? e.message : '확인 중 오류가 발생했습니다.';
        }
        storeCode(input);
        setCode(input);
        setGateNotice(null);
      }
      if (!settings.intro_enabled) {
        intro.finishSilently();
        markIntroSeen();
        sound.startBgm();
      } else intro.start();
      return null;
    },
    [settings.gate, settings.intro_enabled, code, intro],
  );

  const replay = useCallback(() => {
    sound.unlock();
    setCurrentId(null);
    intro.start();
  }, [intro]);

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
  if (!granted || state.status === 'loading') status = <GallerySkeleton />;
  else if (state.status === 'error') status = <ErrorState message={state.message} onRetry={retry} />;
  else if (winners && winners.length === 0) status = <EmptyState />;

  const showIntroLayer = !introDone;
  const gate = (
    <>
      <GateTitle title={settings.event_title} subtitle={settings.event_subtitle} year={settings.year} />
      <AccessGate
        mode={settings.gate}
        hasCode={!!code}
        onEnter={enter}
        notice={gateNotice}
        onRecheck={onRecheck}
      />
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
        footer={introDone && settings.intro_enabled ? <ReplayButton onReplay={replay} /> : null}
      />
      <RevealSpotlight targetId={highlightId} />
      {showIntroLayer && <Intro state={introState} reduced={reduced} introLine={settings.intro_line} gate={gate} />}
      {introState.status === 'running' && <SkipButton onSkip={intro.skip} />}
      {winners && (
        <DetailOverlay winners={winners} currentId={currentId} onNavigate={open} onClose={() => setCurrentId(null)} />
      )}
      <Confetti burstKey={confetti.key} scale={confetti.scale} originX={confetti.x} />
      <CameraFlash flashKey={flash.key} intensity={flash.intensity} full={flash.full} />
      <SoundToggle />
    </main>
  );
}
