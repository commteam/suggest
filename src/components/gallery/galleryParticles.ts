import type { CSSProperties } from 'react';

/**
 * 떠다니는 빛 입자 (보케 점 + 십자 반짝임) — CSS 로 구현.
 * 성능: 입자 26개를 각각 애니메이션하거나 canvas(rAF)로 그리면 저사양 기기에서 메인 스레드 부담이 컸음(측정).
 * 그래서 점 입자는 "입자 층" 몇 개(층 하나 = 여러 점을 배경 그라데이션으로 그린 한 요소)를 통째로 움직이고,
 * 십자 반짝임만 개별 요소로 둔다. 움직이는 요소 수 = 층 수 + 별 수 (기본 3 + 6 = 9).
 */
type Vars = CSSProperties & Record<`--${string}`, string>;

export interface ParticleLayer {
  dots: number;
  style: Vars;
}
export interface StarParticle {
  style: Vars;
}

/** 시드 고정 난수 (매번 같은 배치) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLUE = '219, 232, 255';

export const PARTICLE_PRESET = {
  normal: { layers: 3, dotsPerLayer: 7, stars: 6 },
  low: { layers: 2, dotsPerLayer: 7, stars: 3 },
};

export function makeParticles(low = false, seed = 2026) {
  const preset = low ? PARTICLE_PRESET.low : PARTICLE_PRESET.normal;
  const rnd = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();

  // 층마다 주기·떠오르는 높이·좌우 흔들림·시작 지점이 다르고, 층 안의 점은 크기·밝기·색이 제각각
  const layers: ParticleLayer[] = Array.from({ length: preset.layers }, (_, li) => {
    const gradients = Array.from({ length: preset.dotsPerLayer }, () => {
      const r = between(1.5, 4.2);
      const a = between(0.25, 0.6);
      const gold = rnd() < 0.3;
      const color = (alpha: number) =>
        gold
          ? `color-mix(in oklab, var(--c-accent) ${Math.round(alpha * 100)}%, transparent)`
          : `rgba(${BLUE}, ${alpha.toFixed(2)})`;
      const outer = (r * 2.4).toFixed(1);
      return `radial-gradient(circle ${outer}px at ${between(3, 97).toFixed(1)}% ${between(28, 94).toFixed(1)}%, ${color(a)} 0, ${color(a * 0.45)} ${r.toFixed(1)}px, transparent ${outer}px)`;
    });
    const dur = [13, 17, 21][li % 3] + between(-1, 1);
    return {
      dots: preset.dotsPerLayer,
      style: {
        backgroundImage: gradients.join(', '),
        '--l-dur': `${dur.toFixed(1)}s`,
        '--l-delay': `${(-(dur / preset.layers) * li - between(0, 2)).toFixed(1)}s`,
        '--l-rise': `${Math.round(between(90, 170))}px`,
        '--l-drift': `${Math.round(between(-26, 26))}px`,
      },
    };
  });

  const stars: StarParticle[] = Array.from({ length: preset.stars }, () => {
    const size = between(9, 16);
    const dur = between(3.5, 7);
    return {
      style: {
        left: `${between(5, 95).toFixed(1)}%`,
        top: `${between(8, 68).toFixed(1)}%`,
        width: `${size.toFixed(1)}px`,
        height: `${size.toFixed(1)}px`,
        '--p-color': rnd() < 0.35 ? 'color-mix(in oklab, var(--c-accent) 85%, white)' : `rgb(${BLUE})`,
        '--p-alpha': between(0.4, 0.75).toFixed(2),
        '--p-dur': `${dur.toFixed(1)}s`,
        '--p-delay': `${(-between(0, dur)).toFixed(1)}s`,
      },
    };
  });

  return { layers, stars, total: preset.layers * preset.dotsPerLayer + preset.stars };
}
