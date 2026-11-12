import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CameraFlash } from '@/components/common/CameraFlash';
import { EmptyState, ErrorState } from '@/components/common/StatusMessage';
import { DetailOverlay } from '@/components/detail/DetailOverlay';
import { Gallery, GallerySkeleton } from '@/components/gallery/Gallery';
import { useAccentColor } from '@/hooks/useAccentColor';
import { usePublicSettings, usePublicWinners } from '@/hooks/useAwards';
import { DEFAULT_SETTINGS } from '@/lib/data/seedData';
import type { PublicWinner } from '@/lib/data/types';
import { markOpened, useOpenedSet } from '@/lib/openedStore';

export default function PublicPage() {
  const { settings, error: settingsError, reload } = usePublicSettings();
  useAccentColor(settings?.accent_color);
  const { state, retry } = usePublicWinners(null, !!settings);
  const opened = useOpenedSet();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const s = settings ?? { ...DEFAULT_SETTINGS, gate: 'open' as const };
  const winners = state.status === 'ready' ? state.winners : null;

  const open = useCallback((w: PublicWinner) => {
    if (!w.is_revealed) {
      toast('발표 전입니다', { description: '조금만 기다려 주세요. 곧 공개됩니다.' });
      return;
    }
    setFlashKey((k) => k + 1);
    markOpened(w.id);
    setCurrentId(w.id);
  }, []);

  let status = null;
  if (settingsError) status = <ErrorState message={settingsError} onRetry={reload} />;
  else if (!settings || state.status === 'loading') status = <GallerySkeleton />;
  else if (state.status === 'error') status = <ErrorState message={state.message} onRetry={retry} />;
  else if (winners && winners.length === 0) status = <EmptyState />;

  return (
    <main className="relative min-h-[100svh] bg-bg">
      <Gallery
        title={s.event_title}
        subtitle={s.event_subtitle}
        year={s.year}
        winners={winners}
        opened={opened}
        show
        onOpen={open}
        status={status}
      />
      {winners && (
        <DetailOverlay winners={winners} currentId={currentId} onNavigate={open} onClose={() => setCurrentId(null)} />
      )}
      <CameraFlash flashKey={flashKey} intensity={0.85} />
    </main>
  );
}
