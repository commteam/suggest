import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 움직임 줄이기 설정 (framer-motion 이 처음 읽기 전에 설정)
vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') && !query.includes('no-preference'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const { WallBackdrop } = await import('./WallBackdrop');

describe('무대 장식: 움직임 줄이기', () => {
  it('애니메이션 요소가 없고, 정지된 장식(커튼·트러스·바닥·아르데코·트로피)과 정지된 시네마틱 빛만 남음', () => {
    const { container } = render(<WallBackdrop lit />);
    expect(container.querySelectorAll('[data-anim]')).toHaveLength(0);
    expect(container.querySelector('[data-decor="confetti"]')).toBeNull();
    expect(container.querySelector('[data-decor="wall-stars"]')).toBeNull();
    for (const name of ['curtains', 'truss', 'floor', 'deco-corners', 'cine-sky', 'cine-pillars', 'cine-wings', 'cine-lasers', 'cine-horizon', 'cine-floor']) expect(container.querySelector(`[data-decor="${name}"]`)).not.toBeNull();
    expect(container.querySelectorAll('.stage-curtain')).toHaveLength(2);
    expect(container.querySelectorAll('[data-decor="trophy"]')).toHaveLength(2);
    // 깜빡이거나 가로지르는 빛(렌즈 플레어·아나모픽 플래시)은 그리지 않음
    expect(container.querySelector('[data-decor="cine-sparkles"]')).toBeNull();
    expect(container.querySelector('.cine-sweep')).toBeNull();
  });
});
