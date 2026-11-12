import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BEAMS } from './galleryBeams';
import { WallBackdrop } from './WallBackdrop';

const alphas = (v: string) => [...v.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
const percents = (v: string) => [...v.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));

describe('갤러리 무대 조명', () => {
  afterEach(cleanup);

  it('빔 3개 + 넓은 광원 1개, 전부 장식(aria-hidden)이고 클릭을 막지 않음', () => {
    const { container, getByTestId } = render(<WallBackdrop lit />);
    const lights = getByTestId('gallery-lights');
    expect(container.querySelectorAll('[data-light="beam"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-light="wash"]')).toHaveLength(1);
    expect(lights.getAttribute('aria-hidden')).toBe('true');
    expect(lights.closest('[aria-hidden="true"]')).not.toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toContain('pointer-events-none');
  });

  it('lit 이 false 면 꺼진 상태, true 가 되면 켜짐 (CSS 가 1.2초 페이드)', () => {
    const { getByTestId, rerender } = render(<WallBackdrop lit={false} />);
    expect(getByTestId('gallery-lights').dataset.lit).toBe('false');
    rerender(<WallBackdrop lit />);
    expect(getByTestId('gallery-lights').dataset.lit).toBe('true');
  });

  it('lit 생략 시 켜짐', () => {
    const { getByTestId } = render(<WallBackdrop />);
    expect(getByTestId('gallery-lights').dataset.lit).toBe('true');
  });

  it('빔마다 위치·주기·시작 지점이 달라 박자가 맞지 않음 (주기 9~16초)', () => {
    const durs = BEAMS.map((b) => parseFloat(b['--beam-dur']!));
    const delays = BEAMS.map((b) => b['--beam-delay']);
    const xs = BEAMS.map((b) => b['--beam-x']);
    expect(new Set(durs).size).toBe(3);
    expect(new Set(delays).size).toBe(3);
    expect(new Set(xs).size).toBe(3);
    for (const d of durs) {
      expect(d).toBeGreaterThanOrEqual(9);
      expect(d).toBeLessThanOrEqual(16);
    }
  });

  it('빔 최대 투명도는 0.18 이하 (은은하게)', () => {
    for (const b of BEAMS) {
      for (const k of ['--beam-color', '--beam-core'] as const) {
        const v = b[k]!;
        for (const a of alphas(v)) expect(a).toBeLessThanOrEqual(0.18);
        if (v.includes('transparent')) for (const p of percents(v)) expect(p).toBeLessThanOrEqual(18);
      }
    }
  });
});
