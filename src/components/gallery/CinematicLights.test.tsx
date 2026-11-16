import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  floorGlitter,
  GOLD_BEAMS,
  goldGlitter,
  LASER_ANGLES,
  LASER_FINE_ANGLES,
  makeStars,
  makeTwinkleGroups,
  PILLARS,
  polar,
  SPARKLES,
  wingCurves,
} from './cinematicConfig';
import { DECOR_ORDER } from './stageDecorConfig';
import { WallBackdrop } from './WallBackdrop';

const CINE = ['cine-sky', 'cine-pillars', 'cine-wings', 'cine-lasers', 'cine-horizon', 'cine-sparkles', 'cine-floor'];

describe('시네마틱 무대 조명', () => {
  afterEach(cleanup);

  it('레이어 7종이 무대 배경 안에 있고, 클릭·포커스 요소 없이 aria-hidden 아래에 있음', () => {
    const { container } = render(<WallBackdrop lit />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    for (const name of CINE) expect(root.querySelectorAll(`[data-decor="${name}"]`)).toHaveLength(1);
    expect(root.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    expect(root.querySelectorAll('img, image')).toHaveLength(0);
  });

  it('등장 순서: 하늘 → 기둥 → 날개 → 지평선·레이저 → 플레어', () => {
    const { container } = render(<WallBackdrop lit />);
    const order = (n: string) => Number((container.querySelector(`[data-decor="${n}"]`) as HTMLElement).style.getPropertyValue('--decor-order'));
    expect(order('cine-sky')).toBe(DECOR_ORDER.curtains);
    expect(order('cine-pillars')).toBe(DECOR_ORDER.rig);
    expect(order('cine-wings')).toBe(DECOR_ORDER.laurel);
    expect(order('cine-lasers')).toBe(DECOR_ORDER.floor);
    expect(order('cine-horizon')).toBe(DECOR_ORDER.floor);
    expect(order('cine-sparkles')).toBe(DECOR_ORDER.particles);
  });

  it('움직이는 요소: 레이저 좌·우와 금빛 빔, 폭발광·코어 플레어·아나모픽 플래시, 플레어 5개, 기둥 7개(두 무리)', () => {
    const { container } = render(<WallBackdrop lit />);
    const n = (sel: string) => container.querySelectorAll(sel).length;
    expect(n('.cine-fan[data-anim]')).toBe(2);
    expect(n('.cine-gold[data-anim]')).toBe(1);
    expect(n('.cine-burst[data-anim], .cine-core-flare[data-anim], .cine-sweep[data-anim]')).toBe(3);
    expect(n('.cine-sparkle[data-anim]')).toBe(SPARKLES.length);
    expect(n('.cine-pillar')).toBe(PILLARS.length);
    expect(n('.cine-pillar-group[data-anim]')).toBe(2);
    expect(n('.cine-twinkle[data-anim]')).toBe(2);
    expect(n('.cine-wing-half[data-anim]')).toBe(4);
    expect(n('.cine-glitter[data-anim]')).toBe(2);
  });

  it('레이저: 좌우 대칭, 가는 보조선은 굵은 선 사이, 금빛 빔은 레이저보다 낮은 각도', () => {
    const [x, y] = polar(30, 10);
    expect(x).toBeCloseTo(8.66, 2);
    expect(y).toBeCloseTo(-5, 2);
    for (let i = 0; i < LASER_FINE_ANGLES.length; i++) {
      expect(LASER_FINE_ANGLES[i]).toBeGreaterThan(LASER_ANGLES[i]);
      expect(LASER_FINE_ANGLES[i]).toBeLessThan(LASER_ANGLES[i + 1]);
    }
    const maxGold = Math.max(...GOLD_BEAMS.flat());
    expect(maxGold).toBeLessThan(LASER_ANGLES[0]);
    // 금빛 반짝이는 빔 안쪽에만
    for (const g of goldGlitter(60)) {
      const ang = (Math.atan2(-g.y, Math.abs(g.x)) * 180) / Math.PI;
      expect(GOLD_BEAMS.some(([a, b]) => ang >= a - 0.01 && ang <= b + 0.01)).toBe(true);
    }
  });

  it('빛의 날개: 지평선 위 한 점에서 모여 바깥 가장자리로 퍼지고, 좌우 대칭', () => {
    const l = wingCurves('left');
    const r = wingCurves('right');
    expect(l).toHaveLength(14);
    for (const d of l) expect(d.startsWith('M34 99.4')).toBe(true);
    for (const d of r) expect(d.startsWith('M66 99.4')).toBe(true);
    const ends = l.map((d) => Number(d.trim().split(' ').at(-1)));
    expect(Math.min(...ends)).toBeLessThan(10);
    expect(Math.max(...ends)).toBeLessThan(80);
  });

  it('렌즈 플레어는 제목(가운데 위)과 액자 줄(가운데)에 놓이지 않음', () => {
    for (const s of SPARKLES) {
      const inTitle = s.x > 30 && s.x < 70 && s.y < 30;
      const inFrames = s.x > 20 && s.x < 80 && s.y > 30;
      expect(inTitle || inFrames).toBe(false);
    }
  });

  it('별·반짝이: 시드 고정, 개수, 범위', () => {
    expect(makeStars(50)).toEqual(makeStars(50));
    expect(makeStars(150)).toHaveLength(150);
    for (const s of makeStars(150)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.alpha).toBeLessThanOrEqual(0.75);
    }
    const g = makeTwinkleGroups(2, 14);
    expect(g).toHaveLength(2);
    expect(g[0]).toHaveLength(14);
    expect(floorGlitter(120)).toHaveLength(120);
    // 바닥 반짝이는 지평선(위)쪽이 더 촘촘
    const f = floorGlitter(400);
    expect(f.filter((p) => p.y < 30).length).toBeGreaterThan(f.filter((p) => p.y > 70).length);
  });
});
