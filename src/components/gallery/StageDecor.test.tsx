import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Laurel } from './StageDecor';
import { CONFETTI_COUNT, DECOR_ORDER, makeConfetti } from './stageDecorConfig';
import { WallBackdrop } from './WallBackdrop';

const decor = (root: ParentNode, name: string) => [...root.querySelectorAll<HTMLElement | SVGElement>(`[data-decor="${name}"]`)];
const order = (el: HTMLElement | SVGElement) => Number(el.style.getPropertyValue('--decor-order'));

describe('무대 장식 (StageDecor)', () => {
  afterEach(cleanup);

  it('커튼·트러스·선버스트·벽 별·바닥·컨페티·트로피 2개를 조합하고 전부 aria-hidden·클릭 통과', () => {
    const { container } = render(<WallBackdrop lit />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
    for (const name of ['curtains', 'truss', 'sunburst', 'wall-stars', 'floor', 'confetti']) expect(decor(root, name)).toHaveLength(1);
    expect(decor(root, 'trophy')).toHaveLength(2);
    expect(root.querySelectorAll('.stage-curtain')).toHaveLength(2);
    // 조명 기구는 서치라이트 빔 4개 위치마다
    expect(root.querySelectorAll('[data-fixture]')).toHaveLength(4);
    // 포커스·클릭 가능한 요소 없음
    expect(root.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
  });

  it('외부 이미지 없이 인라인 SVG/CSS 만 사용', () => {
    const { container } = render(<WallBackdrop lit />);
    expect(container.querySelectorAll('img, image, use[href^="http"]')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/url\((?!#)/); // url(#그라데이션) 만 허용
  });

  it('입장 순서: 커튼 → 조명 기구 → 월계관 → 바닥 → 입자 (0.3초 간격용 순번)', () => {
    const { container } = render(<WallBackdrop lit />);
    const l = render(<Laurel side="left" />).container.firstElementChild as SVGElement;
    expect(order(decor(container, 'curtains')[0])).toBe(DECOR_ORDER.curtains);
    expect(order(decor(container, 'truss')[0])).toBe(DECOR_ORDER.rig);
    expect(order(l)).toBe(DECOR_ORDER.laurel);
    expect(order(decor(container, 'floor')[0])).toBe(DECOR_ORDER.floor);
    expect(order(decor(container, 'confetti')[0])).toBe(DECOR_ORDER.particles);
    expect(Object.values(DECOR_ORDER)).toEqual([0, 1, 2, 3, 4]);
  });

  it('lit 에 따라 켜짐/꺼짐 표시', () => {
    const { container, rerender } = render(<WallBackdrop lit={false} />);
    expect((container.firstElementChild as HTMLElement).dataset.stageLit).toBe('false');
    rerender(<WallBackdrop lit />);
    expect((container.firstElementChild as HTMLElement).dataset.stageLit).toBe('true');
    const laurel = render(<Laurel side="right" lit={false} />).container.firstElementChild as SVGElement;
    expect(laurel.getAttribute('data-lit')).toBe('false');
    expect(laurel.getAttribute('aria-hidden')).toBe('true');
  });

  it('움직이는 요소(data-anim): 커튼 2 · 선버스트 · 벽 별 · 컨페티 · 유성 · 렌즈 플레어', () => {
    const { container } = render(<WallBackdrop lit />);
    const animated = container.querySelectorAll('[data-anim]');
    const confetti = Number((decor(container, 'confetti')[0] as HTMLElement).dataset.count);
    expect(confetti).toBeGreaterThanOrEqual(CONFETTI_COUNT.low);
    expect(confetti).toBeLessThanOrEqual(14);
    expect(animated.length).toBe(2 + 1 + 10 + confetti + 2);
  });

  it('컨페티: 같은 시드면 같은 배치, 속도·회전·떨어지는 위치가 제각각, 별과 리본, 저사양은 개수 감소', () => {
    const a = makeConfetti();
    expect(a).toEqual(makeConfetti());
    expect(a).toHaveLength(CONFETTI_COUNT.normal);
    expect(a.length).toBeGreaterThanOrEqual(10);
    expect(new Set(a.map((p) => p.style['--cf-dur'])).size).toBe(a.length);
    expect(new Set(a.map((p) => p.style['--cf-rot'])).size).toBeGreaterThan(a.length / 2);
    expect(new Set(a.map((p) => p.kind))).toEqual(new Set(['star', 'ribbon']));
    for (const p of a) {
      expect(parseFloat(String(p.style['--cf-dur']))).toBeGreaterThanOrEqual(16);
      expect(Number(p.style['--cf-alpha'])).toBeLessThanOrEqual(0.6);
    }
    expect(makeConfetti(true).length).toBeLessThan(a.length);
  });
});
