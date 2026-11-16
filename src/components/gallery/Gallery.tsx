import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { PublicWinner } from '@/lib/data/types';
import { ConstellationLines } from './Constellation';
import { Frame } from './Frame';
import { Silhouette } from './Silhouette';
import { Laurel } from './StageDecor';
import { cn } from '@/lib/utils';
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
    // 데스크톱(1280px 이상): 왼쪽 큰 제목 단 + 오른쪽 별자리 액자 (모바일·태블릿은 위 제목 + 아래 액자)
    <section aria-labelledby="gallery-title" className="gallery-stage relative isolate flex min-h-[100svh] flex-col overflow-hidden xl:flex-row">
      <WallBackdrop lit={show} />
      <header className="relative z-10 px-6 pt-14 text-center sm:pt-14 xl:flex xl:w-[34%] xl:max-w-[640px] xl:shrink-0 xl:flex-col xl:justify-center xl:pt-0 xl:pr-6 xl:pb-[calc(var(--floor-h)+24px)] xl:pl-[7vw] xl:text-left">
        {/* 모바일: 제목 위 작은 월계관 하나 */}
        <Laurel side="crest" lit={show} className="mx-auto mb-1 block h-6 w-14 sm:hidden" />
        <motion.p
          className="eyebrow text-[0.7rem] sm:text-sm xl:text-[0.95rem]"
          initial={{ opacity: 0, y: 10 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8 }}
        >
          Hall of Fame · {year}
        </motion.p>
        <motion.h1
          id="gallery-title"
          className="gallery-title relative mx-auto mt-3 w-fit text-[2rem] leading-tight font-extrabold tracking-[0.04em] sm:text-5xl xl:mx-0 xl:mt-4 xl:text-[clamp(4.5rem,5.6vw,6.5rem)] xl:leading-[1.03] xl:font-black xl:tracking-[-0.01em]"
          initial={{ opacity: 0, y: 14 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          {/* 제목 양옆 월계관 (태블릿 이상) */}
          <Laurel side="left" lit={show} className="absolute top-1/2 right-full mr-4 hidden h-[78px] w-12 -translate-y-1/2 sm:block lg:mr-6 xl:hidden" />
          {/* 데스크톱은 두 줄 */}
          <span className="metal-text">
            명예의
            <br className="hidden xl:inline" /> 전당
          </span>
          <Laurel side="right" lit={show} className="absolute top-1/2 left-full ml-4 hidden h-[78px] w-12 -translate-y-1/2 sm:block lg:ml-6 xl:hidden" />
        </motion.h1>
        <span aria-hidden className="mt-7 hidden h-0.5 w-56 bg-[linear-gradient(90deg,var(--c-accent),transparent)] xl:block" />
        <motion.p
          className="mt-3 text-sm text-muted sm:text-base xl:mt-6 xl:text-[1.2rem] xl:leading-relaxed xl:text-[#d5ddf0]"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.2 }}
        >
          <span className="block sm:inline xl:block">{title}</span>
          <span aria-hidden className="hidden sm:inline xl:hidden"> · </span>
          <span className="block sm:inline xl:block">{subtitle}</span>
        </motion.p>
        {showClickHint && (
          <motion.p
            className="mt-3 text-xs whitespace-nowrap text-muted/90 sm:text-sm xl:mt-7"
            initial={{ opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.9, delay: 0.35 }}
          >
            <span aria-hidden className="mr-1.5 hidden text-accent-light xl:inline">
              ✦
            </span>
            액자를 클릭하면 수상자가 공개됩니다.
          </motion.p>
        )}
        {/* 데스크톱: '처음 화면으로' 는 제목 단 안에 (모바일·태블릿은 화면 아래) */}
        {footer && <div className="mt-8 hidden xl:block">{footer}</div>}
      </header>

      {/* 아래쪽 여백: 바닥 무대(22vh)가 보이도록 남기고, 액자 묶음은 화면 세로 중앙보다 약간 위에 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pt-16 pb-[150px] sm:px-[7vw] sm:pt-16 sm:pb-[calc(22vh+64px)] lg:px-[11vw] xl:justify-start xl:pt-[6vh] xl:pr-[4vw] xl:pb-[calc(var(--floor-h)+6vh)] xl:pl-0">
        {/* 별자리 선은 액자보다 먼저(아래에) 그림 */}
        {!status && winners && winners.length > 1 && <ConstellationLines count={winners.length} />}
        {status ??
          (winners && winners.length > 0 ? (
            <ul
              className={cn(
                'flex w-full max-w-[1200px] list-none flex-wrap justify-center gap-x-6 gap-y-16 sm:gap-x-9 sm:gap-y-16 xl:items-start xl:justify-around xl:gap-x-3 xl:gap-y-24',
                // 데스크톱: 5명까지 한 줄 별자리, 6명 이상은 두 줄
                winners.length <= 5 && 'xl:flex-nowrap',
              )}
            >
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

      {footer && <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 xl:hidden">{footer}</div>}
    </section>
  );
}

/** 로딩 중 실루엣 스켈레톤 */
export function GallerySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="우수자 정보를 불러오는 중"
      className="flex w-full max-w-[1200px] flex-wrap justify-center gap-x-6 gap-y-16 sm:gap-x-9 sm:gap-y-16"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[calc(50%-0.75rem)] max-w-[165px] sm:w-[150px] lg:w-[152px]">
          <div className="rounded-[4px] bg-[#1a2a52] p-[8px] opacity-60">
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
