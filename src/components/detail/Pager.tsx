import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicWinner } from '@/lib/data/types';
import { cn } from '@/lib/utils';

interface Props {
  winners: PublicWinner[];
  currentId: string;
  onSelect: (w: PublicWinner) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function Pager({ winners, currentId, onSelect, onPrev, onNext, hasPrev, hasNext }: Props) {
  return (
    <nav aria-label="우수자 이동" className="flex items-center justify-center gap-2 sm:gap-4">
      <button type="button" onClick={onPrev} disabled={!hasPrev} className="btn-ghost disabled:opacity-35" aria-label="이전 우수자">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">이전</span>
      </button>
      <ol className="flex list-none items-center gap-1.5 sm:gap-2">
        {winners.map((w) => {
          const active = w.id === currentId;
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSelect(w)}
                aria-current={active ? 'page' : undefined}
                aria-label={`${w.display_order}번${w.is_revealed ? '' : ' (발표 전)'}`}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full font-serif text-sm font-bold transition-all',
                  active
                    ? 'text-[#1a1406] shadow-[0_0_18px_color-mix(in_oklab,var(--c-accent)_55%,transparent)]'
                    : 'border border-line text-muted hover:border-accent hover:text-ink',
                  !w.is_revealed && !active && 'opacity-40',
                )}
                style={active ? { background: 'var(--g-metal)' } : undefined}
              >
                {w.display_order}
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={onNext} disabled={!hasNext} className="btn-ghost disabled:opacity-35" aria-label="다음 우수자">
        <span className="hidden sm:inline">다음</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
