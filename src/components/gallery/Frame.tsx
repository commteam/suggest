import { motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { FRAME_STAGGER_MS } from '@/components/intro/introConfig';
import type { PublicWinner } from '@/lib/data/types';
import { cn } from '@/lib/utils';
import { Nameplate } from './Nameplate';
import { Silhouette } from './Silhouette';

interface Props {
  winner: PublicWinner;
  /** 이 브라우저에서 열어 본 적이 있는지 */
  opened: boolean;
  index: number;
  /** 갤러리 등장 애니메이션 시작 여부 */
  show: boolean;
  highlight?: boolean;
  onOpen: (w: PublicWinner) => void;
}

/** 금색 액자 + 와이어 + 조명 + 명패 */
export function Frame({ winner, opened, index, show, highlight, onOpen }: Props) {
  const reduce = useReducedMotion();
  const visible = winner.is_revealed && opened;
  const locked = !winner.is_revealed;
  const label = locked
    ? `${winner.display_order}번 액자, 발표 전입니다`
    : visible
      ? `${winner.display_order}번 ${winner.dept} ${winner.name} 상세 보기`
      : `${winner.display_order}번 액자 공개하기`;

  return (
    <motion.li
      data-frame-id={winner.id}
      className="group/frame relative w-[calc(50%-0.75rem)] max-w-[220px] sm:w-[200px] lg:w-[208px]"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.92 }}
      animate={show ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ delay: reduce ? 0 : 0.25 + (index * FRAME_STAGGER_MS) / 1000, duration: reduce ? 0.3 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {/* 위에서 떨어지는 푸른 조명 */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-28 left-1/2 h-[calc(100%+7rem)] w-[150%] -translate-x-1/2 transition-opacity duration-500',
          highlight ? 'opacity-100' : 'opacity-55',
          'group-hover/frame:opacity-100',
        )}
        style={{
          background:
            'conic-gradient(from 180deg at 50% 0%, transparent 162deg, rgba(219,232,255,0.16) 172deg, rgba(219,232,255,0.22) 180deg, rgba(219,232,255,0.16) 188deg, transparent 198deg)',
          maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
        }}
      />
      {/* 와이어 */}
      <svg aria-hidden className="absolute -top-14 left-1/2 h-14 w-28 -translate-x-1/2" viewBox="0 0 112 56">
        <path d="M56 6 L18 56 M56 6 L94 56" stroke="#8a95ad" strokeWidth="0.9" fill="none" opacity="0.7" />
        <circle cx="56" cy="5" r="3.4" fill="var(--c-accent)" />
        <circle cx="55" cy="4" r="1.2" fill="#fff" opacity="0.6" />
      </svg>

      <button
        type="button"
        onClick={() => onOpen(winner)}
        aria-label={label}
        className={cn(
          'group relative block w-full rounded-[4px] text-left transition-transform duration-500 ease-out focus-visible:outline-offset-8',
          'hover:-translate-y-2 focus-visible:-translate-y-2',
          highlight && '-translate-y-2',
        )}
      >
        {/* 호버 스포트라이트 */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -inset-10 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100',
            highlight && 'opacity-100',
          )}
          style={{ background: 'radial-gradient(closest-side, rgba(219,232,255,0.22), transparent 75%)' }}
        />
        {/* 액자 */}
        <span
          className={cn(
            'relative block rounded-[4px] p-[9px] transition-shadow duration-500 sm:p-[11px]',
            'shadow-[0_26px_40px_-8px_rgba(0,0,0,0.75),0_8px_14px_rgba(0,0,0,0.5)]',
            'group-hover:shadow-[0_34px_50px_-8px_rgba(0,0,0,0.8),0_0_32px_color-mix(in_oklab,var(--c-accent)_45%,transparent)]',
            highlight && 'shadow-[0_0_48px_color-mix(in_oklab,var(--c-accent)_60%,transparent)]',
          )}
          style={{ background: 'var(--g-frame)' }}
        >
          <span
            className="block rounded-[2px] p-[3px]"
            style={{
              background: 'linear-gradient(145deg, var(--c-accent-dark), color-mix(in oklab, var(--c-accent), black 25%))',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
            }}
          >
            <span className="block bg-[#0b1430] p-[7px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] sm:p-[9px]">
              <span className="relative block aspect-[3/4] overflow-hidden bg-[#0b1530]">
                {visible && winner.photo_url ? (
                  <img src={winner.photo_url} alt={`${winner.name} 증명사진`} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Silhouette />
                )}
                {locked && (
                  <span className="absolute inset-0 flex items-end justify-end p-2">
                    <Lock aria-hidden className="h-4 w-4 text-[#9fb0cc]/70" />
                  </span>
                )}
                {!locked && !visible && (
                  <span aria-hidden className="sheen absolute inset-0 overflow-hidden" />
                )}
                {/* 유리 반사 */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10)_0%,transparent_35%,transparent_70%,rgba(219,232,255,0.05)_100%)]"
                />
              </span>
            </span>
          </span>
        </span>
        <span className="mt-4 block">
          {visible ? (
            <Nameplate order={winner.display_order} title={winner.name} subtitle={winner.dept} />
          ) : (
            <Nameplate order={winner.display_order} title="공개 전" dim={locked} />
          )}
        </span>
      </button>
    </motion.li>
  );
}
