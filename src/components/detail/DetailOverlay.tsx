import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, type KeyboardEvent } from 'react';
import { isRevealed } from '@/lib/data/mask';
import type { PublicWinner } from '@/lib/data/types';
import { Pager } from './Pager';
import { WinnerDetail } from './WinnerDetail';

interface Props {
  winners: PublicWinner[];
  currentId: string | null;
  onNavigate: (w: PublicWinner) => void;
  onClose: () => void;
}

/** 액자 클릭 시 전체 화면 상세 */
export function DetailOverlay({ winners, currentId, onNavigate, onClose }: Props) {
  const current = useMemo(() => winners.find((w) => w.id === currentId) ?? null, [winners, currentId]);
  const revealedIdx = useMemo(() => winners.filter(isRevealed), [winners]);
  const pos = current ? revealedIdx.findIndex((w) => w.id === current.id) : -1;
  const prev = pos > 0 ? revealedIdx[pos - 1] : null;
  const next = pos >= 0 && pos < revealedIdx.length - 1 ? revealedIdx[pos + 1] : null;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        onNavigate(prev);
      } else if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        onNavigate(next);
      }
    },
    [prev, next, onNavigate],
  );

  const open = !!current && current.is_revealed;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg focus:outline-none"
          aria-describedby="detail-desc"
        >
          {/* 배경 조명 */}
          <div aria-hidden className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_25%_0%,rgba(18,48,122,0.55),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_80%_100%,rgba(8,26,68,0.8),transparent_70%)]" />
          </div>

          {current && current.is_revealed && (
            <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-14 sm:px-8 sm:pt-24 lg:max-w-7xl">
              <Dialog.Title className="sr-only">
                {current.dept} {current.name} — {current.topic}
              </Dialog.Title>
              <Dialog.Description id="detail-desc" className="sr-only">
                제안 주제와 개선 전, 추진 내용, 개선 후, 진행 소감을 소개합니다. 좌우 화살표 키로 이동, Esc 로 닫기.
              </Dialog.Description>
              <WinnerDetail winner={current} TitleTag="div" />
              <div className="mt-14 border-t border-line/60 pt-8">
                <Pager
                  winners={winners}
                  currentId={current.id}
                  onSelect={onNavigate}
                  onPrev={() => prev && onNavigate(prev)}
                  onNext={() => next && onNavigate(next)}
                  hasPrev={!!prev}
                  hasNext={!!next}
                />
              </div>
            </div>
          )}

          {/* 스크롤 시 상단 고정 버튼과 본문이 겹쳐 보이지 않도록 */}
          <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[5] h-20 bg-[linear-gradient(to_bottom,var(--c-bg)_35%,transparent)]" />
          <Dialog.Close className="btn-ghost fixed top-4 left-4 z-10" aria-label="갤러리로 돌아가기">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span>갤러리</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
