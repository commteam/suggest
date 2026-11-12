import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BEAMS } from './galleryBeams';
import { makeParticles, PARTICLE_PRESET } from './galleryParticles';
import { WallBackdrop } from './WallBackdrop';

const alphas = (v: string) => [...v.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
const percents = (v: string) => [...v.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));

describe('갤러리 무대 배경', () => {
  afterEach(cleanup);

  it('하단 네모 패널(웨인스코트 박스)이 없고 바닥 그라데이션만 있음', () => {
    const { container } = render(<WallBackdrop lit />);
    const floor = container.querySelector('[data-floor]')!;
    expect(floor).not.toBeNull();
    expect(container.querySelectorAll('[class*="border"]')).toHaveLength(0); // 예전 패널은 border 박스 5개
    expect(floor.querySelectorAll('div').length).toBeLessThanOrEqual(3);
  });

  it('반복 벽지 무늬(다마스크·세로 줄무늬) 없음', () => {
    const { container } = render(<WallBackdrop lit />);
    expect(container.innerHTML).not.toContain('repeating-linear-gradient');
    expect(container.innerHTML).not.toMatch(/background-size/);
  });

  it('레이어 5종: 글로우 · 빔 4개 · 광원 · 입자(20~30개) · 플래시, 전부 aria-hidden·클릭 통과', () => {
    const { container, getByTestId } = render(<WallBackdrop lit />);
    expect(container.querySelectorAll('[data-light="glow"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-light="beam"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-light="wash"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-light="flash"]')).toHaveLength(1);
    const box = container.querySelector('[data-light="particles"]') as HTMLElement;
    const total = Number(box.dataset.count);
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(30);
    const dotsInLayers = [...box.querySelectorAll<HTMLElement>('[data-particle-layer]')].reduce((s, el) => s + Number(el.dataset.particleLayer), 0);
    expect(dotsInLayers + box.querySelectorAll('[data-particle="star"]').length).toBe(total);
    expect(getByTestId('gallery-lights').getAttribute('aria-hidden')).toBe('true');
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
  });

  it('lit 이 false 면 꺼짐, true 가 되면 켜짐 (생략 시 켜짐)', () => {
    const { getByTestId, rerender } = render(<WallBackdrop lit={false} />);
    expect(getByTestId('gallery-lights').dataset.lit).toBe('false');
    rerender(<WallBackdrop lit />);
    expect(getByTestId('gallery-lights').dataset.lit).toBe('true');
    cleanup();
    expect(render(<WallBackdrop />).getByTestId('gallery-lights').dataset.lit).toBe('true');
  });

  it('빔 4개는 위치·주기(9~18초)·시작 지점이 모두 다름, 최대 투명도 0.22 이하', () => {
    const durs = BEAMS.map((b) => parseFloat(b['--beam-dur']!));
    expect(new Set(durs).size).toBe(4);
    expect(new Set(BEAMS.map((b) => b['--beam-delay'])).size).toBe(4);
    expect(new Set(BEAMS.map((b) => b['--beam-x'])).size).toBe(4);
    for (const d of durs) {
      expect(d).toBeGreaterThanOrEqual(9);
      expect(d).toBeLessThanOrEqual(18);
    }
    for (const b of BEAMS)
      for (const k of ['--beam-color', '--beam-core'] as const) {
        const v = b[k]!;
        for (const a of alphas(v)) expect(a).toBeLessThanOrEqual(0.22);
        if (v.includes('transparent')) for (const p of percents(v)) expect(p).toBeLessThanOrEqual(22);
      }
  });

  it('입자: 같은 시드면 같은 배치, 층·별마다 속도·크기·밝기가 제각각, 저사양은 개수 감소', () => {
    const a = makeParticles();
    expect(a).toEqual(makeParticles());
    const n = PARTICLE_PRESET.normal;
    expect(a.total).toBe(n.layers * n.dotsPerLayer + n.stars);
    expect(new Set(a.layers.map((l) => l.style['--l-dur'])).size).toBe(n.layers);
    expect(new Set(a.layers.map((l) => l.style['--l-drift'])).size).toBe(n.layers);
    expect(new Set(a.stars.map((s) => s.style.width)).size).toBe(n.stars);
    expect(new Set(a.stars.map((s) => s.style['--p-dur'])).size).toBe(n.stars);
    for (const s of a.stars) expect(Number(s.style['--p-alpha'])).toBeLessThanOrEqual(0.75);
    // 한 층 안의 점들도 크기·밝기가 다름
    const sizes = [...String(a.layers[0].style.backgroundImage).matchAll(/circle ([\d.]+)px/g)].map((m) => m[1]);
    expect(new Set(sizes).size).toBe(n.dotsPerLayer);
    expect(makeParticles(true).total).toBeLessThan(a.total);
  });
});
