import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { PublicWinner } from '@/lib/data/types';
import { Frame } from './Frame';
import { Silhouette } from './Silhouette';
import { WallBackdrop } from './WallBackdrop';

interface Props {
  title: string;
  subtitle: string;
  year: number;
  winners: PublicWinner[] | null;
  opened: ReadonlySet<string>;
  show: boolean;
  highlightId?: string | null;
  onOpen: (w: PublicWinner) => void;
  status?: ReactNode;
  footer?: ReactNode;
}

/** 명예의 전당 */
export function Gallery({ title, subtitle, year, winners, opened, show, highlightId, onOpen, status, footer }: Props) {
  // 로딩·오류·빈 목록(status)이 아니고, 클릭해서 열 수 있는(공개된) 액자가 실제로 있을 때만 안내
  const showClickHint = !status && !!winners?.some((w) => w.is_revealed);
  return (
    <section aria-labelledby="gallery-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <WallBackdrop />
      <header className="relative z-10 px-6 pt-16 text-center sm:pt-14">
        <motion.p
          className="eyebrow text-[0.7rem] sm:text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8 }}
        >
          Hall of Fame · {year}
        </motion.p>
        <motion.h1
          id="gallery-title"
          className="mt-3 text-[2rem] leading-tight font-extrabold tracking-[0.04em] sm:text-5xl"
          initial={{ opacity: 0, y: 14 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          <span className="metal-text">명예의 전당</span>
        </motion.h1>
        <motion.p
          className="mt-3 text-sm text-muted sm:text-base"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.2 }}
        >
          <span className="block sm:inline">{title}</span>
          <span aria-hidden className="hidden sm:inline"> · </span>
          <span className="block sm:inline">{subtitle}</span>
        </motion.p>
        {showClickHint && (
          <motion.p
            className="mt-3 text-xs whitespace-nowrap text-muted/90 sm:text-sm"
            initial={{ opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.9, delay: 0.35 }}
          >
            액자를 클릭하면 수상자가 공개됩니다.
          </motion.p>
        )}
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pt-20 pb-[190px] sm:px-8 sm:pt-24 sm:pb-[calc(22vh+40px)]">
        {status ??
          (winners && winners.length > 0 ? (
            <ul className="flex w-full max-w-[1200px] list-none flex-wrap justify-center gap-x-6 gap-y-20 sm:gap-x-10 sm:gap-y-24">
              {winners.map((w, i) => (
                <Frame
                  key={w.id}
                  winner={w}
                  index={i}
                  show={show}
                  opened={opened.has(w.id)}
                  highlight={highlightId === w.id}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          ) : null)}
      </div>

      {footer && <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">{footer}</div>}
    </section>
  );
}

/** 로딩 중 실루엣 스켈레톤 */
export function GallerySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="우수자 정보를 불러오는 중"
      className="flex w-full max-w-[1200px] flex-wrap justify-center gap-x-6 gap-y-20 sm:gap-x-10"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[calc(50%-0.75rem)] max-w-[220px] sm:w-[200px] lg:w-[208px]">
          <div className="rounded-[4px] bg-[#1a2a52] p-[11px] opacity-60">
            <div className="aspect-[3/4]">
              <Silhouette pulse />
            </div>
          </div>
          <div className="mx-auto mt-4 h-10 w-[92%] animate-pulse rounded-[3px] bg-[#1a2a52]/70" />
        </div>
      ))}
    </div>
  );
}
