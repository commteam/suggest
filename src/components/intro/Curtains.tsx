import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { CURTAIN_OPEN_MS } from './introConfig';

const velvet = {
  backgroundColor: 'var(--c-velvet)',
  backgroundImage: [
    // 주름 사이 푸른 하이라이트
    'repeating-linear-gradient(90deg, transparent 0 calc(var(--fold) * 0.38), rgba(120,160,255,0.16) calc(var(--fold) * 0.44), transparent calc(var(--fold) * 0.52), transparent var(--fold))',
    // 주름 명암
    'repeating-linear-gradient(90deg, #06143a 0, #0c2463 calc(var(--fold) * 0.22), #1a3f98 calc(var(--fold) * 0.44), #12307a calc(var(--fold) * 0.6), #0a1d52 calc(var(--fold) * 0.82), #06143a var(--fold))',
  ].join(','),
};

const shade =
  'linear-gradient(to bottom, rgba(2,6,18,0.55) 0%, transparent 18%, transparent 72%, rgba(2,6,18,0.65) 100%)';

function Panel({ side, open, reduced }: { side: 'left' | 'right'; open: boolean; reduced: boolean }) {
  const dur = (reduced ? CURTAIN_OPEN_MS.reduced : CURTAIN_OPEN_MS.normal) / 1000;
  return (
    <motion.div
      className="absolute top-0 bottom-0 w-1/2 overflow-hidden"
      style={{ [side]: 0, ...velvet, transformOrigin: side === 'left' ? 'left center' : 'right center' } as CSSProperties}
      initial={false}
      animate={
        open
          ? { x: side === 'left' ? '-101%' : '101%', scaleX: reduced ? 1 : 0.86 }
          : { x: '0%', scaleX: 1 }
      }
      transition={{ duration: dur, ease: [0.65, 0, 0.3, 1] }}
    >
      <div className="absolute inset-0" style={{ background: shade }} />
      {/* 가운데 겹침부 그림자 */}
      <div
        className="absolute top-0 bottom-0 w-16"
        style={{
          [side === 'left' ? 'right' : 'left']: 0,
          background: `linear-gradient(${side === 'left' ? 'to left' : 'to right'}, rgba(2,6,18,0.7), transparent)`,
        }}
      />
      {/* 밑단 */}
      <div className="absolute inset-x-0 bottom-0 h-6 bg-[linear-gradient(to_bottom,transparent,rgba(2,6,18,0.7))]" />
    </motion.div>
  );
}

/** 로열 블루 벨벳 커튼 + 상단 발란스(골드 라인) */
export function Curtains({ open, reduced, liftValance }: { open: boolean; reduced: boolean; liftValance: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 [--fold:44px] sm:[--fold:72px]">
      <Panel side="left" open={open} reduced={reduced} />
      <Panel side="right" open={open} reduced={reduced} />
      <motion.div
        className="absolute inset-x-0 top-0 h-[clamp(52px,9vh,100px)]"
        initial={false}
        animate={{ y: liftValance ? '-110%' : '0%' }}
        transition={{ duration: reduced ? 0.4 : 1.2, ease: 'easeInOut' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#050d26',
            backgroundImage:
              'radial-gradient(ellipse 60px 40px at 50% 0%, rgba(26,63,152,0.55), transparent 70%), repeating-linear-gradient(90deg, #040a1e 0 4px, #081a44 30px, #040a1e 60px)',
            backgroundSize: '120px 100%, auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
          }}
        />
        {/* 스와그(물결 밑단) */}
        <div
          className="absolute inset-x-0 -bottom-3 h-4"
          style={{
            background: 'radial-gradient(circle at 50% 0, #050d26 62%, transparent 64%)',
            backgroundSize: '48px 16px',
          }}
        />
        {/* 골드 라인 */}
        <div className="absolute inset-x-0 bottom-1.5 h-[3px]" style={{ background: 'var(--g-metal)' }} />
        <div
          className="absolute inset-x-0 -bottom-2 h-2 opacity-80"
          style={{
            background: 'repeating-linear-gradient(90deg, var(--c-accent) 0 2px, transparent 2px 7px)',
            maskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
        />
      </motion.div>
    </div>
  );
}
