import type { CSSProperties } from 'react';
import { mulberry32 } from './galleryParticles';

/** 무대 장식(StageDecor.tsx) 공용 설정 */
export type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** 입장 연출 순번: 순번 × 0.3초 뒤에 나타남 (커튼 → 조명 기구 → 월계관 → 바닥 → 입자) */
export const DECOR_ORDER = { curtains: 0, rig: 1, laurel: 2, floor: 3, particles: 4 } as const;

export const STAR_PATH = 'M12 0 L14.9 8.4 L24 9.2 L17 15 L19.4 24 L12 19 L4.6 24 L7 15 L0 9.2 L9.1 8.4 Z';

export const CONFETTI_COUNT = { normal: 12, low: 7 } as const;

export function makeConfetti(low = false, seed = 314) {
  const rnd = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const n = low ? CONFETTI_COUNT.low : CONFETTI_COUNT.normal;
  return Array.from({ length: n }, (_, i) => {
    const dur = between(16, 30);
    const kind = i % 3 === 2 ? 'ribbon' : 'star';
    const gold = rnd() < 0.62;
    return {
      kind,
      color: gold ? 'var(--c-accent-light)' : '#dbe8ff',
      size: kind === 'star' ? between(7, 13) : between(10, 16),
      style: {
        left: `${((i + 0.5) / n) * 100 + between(-3, 3)}%`,
        '--cf-dur': `${dur.toFixed(1)}s`,
        '--cf-delay': `${(-between(0, dur)).toFixed(1)}s`,
        '--cf-drift': `${Math.round(between(-60, 60))}px`,
        '--cf-rot': `${Math.round(between(200, 540)) * (rnd() < 0.5 ? -1 : 1)}deg`,
        '--cf-alpha': between(0.35, 0.6).toFixed(2),
      } as Vars,
    };
  });
}

