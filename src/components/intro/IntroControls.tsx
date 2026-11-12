import { FastForward, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useSoundPref } from '@/lib/audio/soundPref';

export function SoundToggle() {
  const { enabled, toggle } = useSoundPref();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? '효과음 끄기' : '효과음 켜기'}
      title={enabled ? '효과음 끄기' : '효과음 켜기'}
      className="btn-ghost fixed top-3 right-3 z-[95] !h-10 !w-10 !justify-center !p-0 sm:top-4 sm:right-4"
    >
      {enabled ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button type="button" onClick={onSkip} className="btn-ghost fixed right-4 bottom-4 z-[95] text-sm sm:right-6 sm:bottom-6">
      건너뛰기
      <FastForward className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function ReplayButton({ onReplay }: { onReplay: () => void }) {
  return (
    <button type="button" onClick={onReplay} className="btn-ghost text-sm">
      <RotateCcw className="h-4 w-4" aria-hidden />
      오프닝 다시 보기
    </button>
  );
}
