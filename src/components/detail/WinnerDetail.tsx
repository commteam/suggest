import { motion, useReducedMotion } from 'framer-motion';
import type { RevealedWinner } from '@/lib/data/types';
import { DevelopingPhoto } from './DevelopingPhoto';
import { ReflectionCard, StoryFlow } from './StoryBlock';

/**
 * 상세 본문. 공개 화면과 관리자 미리보기가 같은 컴포넌트를 사용합니다.
 * compact=true 이면 좁은 미리보기 패널용(항상 세로 쌓기).
 */
export function WinnerDetail({ winner, compact = false, TitleTag = 'h2' }: { winner: RevealedWinner; compact?: boolean; TitleTag?: 'h2' | 'div' }) {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay } };

  return (
    <div
      className={
        compact
          ? 'grid gap-8'
          : 'grid gap-10 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:gap-12'
      }
    >
      <aside className={compact ? 'text-center' : 'self-start text-center lg:sticky lg:top-12 lg:text-left'}>
        <div className={compact ? 'mx-auto w-[170px]' : 'mx-auto w-[180px] sm:w-[210px] lg:w-full'}>
          <DevelopingPhoto src={winner.photo_url} alt={`${winner.name} 증명사진`} replayKey={winner.id} />
        </div>
        <motion.div key={`name-${winner.id}`} className="mt-5" {...enter(0.6)}>
          <p className="eyebrow text-xs sm:text-sm">No. {winner.display_order}</p>
          <TitleTag className="mt-2 text-4xl leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-5xl">
            {winner.name}
            {winner.position && (
              <span className="ml-2 align-middle font-sans text-lg font-normal tracking-normal text-muted sm:text-xl">
                {winner.position}
              </span>
            )}
          </TitleTag>
          <p className="mt-2 text-base text-muted sm:text-lg">{winner.dept}</p>
          <span
            aria-hidden
            className={compact ? 'mx-auto mt-4 block h-px w-24' : 'mx-auto mt-4 block h-px w-24 lg:mx-0'}
            style={{ background: 'linear-gradient(90deg, transparent, var(--c-accent), transparent)' }}
          />
        </motion.div>
      </aside>

      <div className="min-w-0">
        <motion.div key={`topic-${winner.id}`} className="mb-9" {...enter(0.8)}>
          <p className="inline-block rounded-full border border-accent/50 px-3 py-0.5 text-xs tracking-[0.2em] text-accent-light">
            제안 주제
          </p>
          <p className="mt-3 text-2xl leading-[1.35] font-bold tracking-[-0.02em] text-ink sm:text-[2rem]">{winner.topic}</p>
        </motion.div>
        <motion.div key={`flow-${winner.id}`} {...enter(1)}>
          <StoryFlow as_is={winner.as_is} actions={winner.actions} to_be={winner.to_be} />
          <ReflectionCard text={winner.reflection} name={winner.name} />
        </motion.div>
      </div>
    </div>
  );
}
