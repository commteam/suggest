import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { IntroState } from '@/lib/intro/timeline';
import { Curtains } from './Curtains';
import { GoldDots } from './GoldDots';
import { SpotlightCanvas } from './SpotlightCanvas';

interface Props {
  state: IntroState;
  reduced: boolean;
  introLine: string;
  /** 대기 화면(입장하기/접속 코드/준비 중) */
  gate: ReactNode;
}

/**
 * 오프닝 무대: 커튼, 어둠, 스포트라이트, 문구, 골드 점.
 * 플래시와 색종이는 페이지 레벨에서 그립니다(갤러리 위에도 보여야 하므로).
 */
export function Intro({ state, reduced, introLine, gate }: Props) {
  const idle = state.status === 'idle';
  const darkness = idle ? 0.25 : state.curtainsOpen ? 0 : 0.78 - state.spotlight * 0.38;

  return (
    <div className={`fixed inset-0 z-40 ${state.curtainsOpen ? 'pointer-events-none' : ''}`}>
      <Curtains open={state.curtainsOpen} reduced={reduced} liftValance={state.galleryIn} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-[#02050d]"
        initial={false}
        animate={{ opacity: darkness }}
        transition={{ duration: idle ? 0.3 : 1.1 }}
      />
      {!state.galleryIn && (
        <SpotlightCanvas
          intensity={state.spotlight}
          focus={state.status === 'running' && state.dots > 0}
          reduced={reduced}
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        />
      )}

      <div className="absolute inset-0 z-40 flex items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {idle && (
            <motion.div
              key="gate"
              className="w-full max-w-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.35 } }}
              transition={{ duration: 0.8 }}
            >
              {gate}
            </motion.div>
          )}
          {state.status === 'running' && !state.curtainsOpen && (
            <motion.div
              key="headline"
              className="text-center"
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <motion.p
                className="mx-auto max-w-3xl font-serif text-[1.65rem] leading-snug font-extrabold text-ink sm:text-5xl"
                style={{ textShadow: '0 2px 24px rgba(2,5,13,0.95), 0 0 2px rgba(2,5,13,0.9)' }}
                initial={{ opacity: 0, y: 28 }}
                animate={state.headline ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
              >
                {introLine}
              </motion.p>
              <motion.div
                className="mt-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: state.headline ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <GoldDots lit={state.dots} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** 대기 화면 공통 타이틀 블록 */
export function GateTitle({ title, subtitle, year }: { title: string; subtitle: string; year: number }) {
  return (
    <div className="text-center" style={{ textShadow: '0 2px 18px rgba(2,5,13,0.9)' }}>
      <p className="eyebrow text-base sm:text-lg">The {year} Ceremony</p>
      <h1 className="mt-3 font-display text-[2.4rem] leading-[1.05] font-semibold tracking-[0.06em] uppercase italic sm:text-7xl">
        <span className="metal-text">{title}</span>
      </h1>
      <div aria-hidden className="mx-auto my-5 flex items-center justify-center gap-3">
        <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,var(--c-accent))]" />
        <span className="h-1.5 w-1.5 rotate-45 bg-accent" />
        <span className="h-px w-16 bg-[linear-gradient(90deg,var(--c-accent),transparent)]" />
      </div>
      <p className="font-serif text-lg font-bold text-ink sm:text-2xl">{subtitle}</p>
    </div>
  );
}
