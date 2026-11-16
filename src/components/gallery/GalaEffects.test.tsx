import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AURORA, CAMERA_FLASHES, METEORS, ORBS, SPARKLES, SPARKLES_DESKTOP } from './cinematicConfig';
import { Gallery } from './Gallery';
import { WallBackdrop } from './WallBackdrop';

/** 데스크톱(시안 C) 화면 구역 (%): 제목 단 · 액자 별자리 */
const inTitle = (x: number, y: number) => x > 6 && x < 34 && y > 16 && y < 70;
const inFrames = (x: number, y: number) => x > 36 && x < 96 && y > 16 && y < 70;

describe('데스크톱 갈라 무대 (시안 C)', () => {
  afterEach(cleanup);

  it('오로라·고리 행성·오브제·서치라이트·별똥별·카메라 플래시가 무대 배경 안(aria-hidden, 클릭 통과)에 있음', () => {
    const { container } = render(<WallBackdrop lit />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    for (const n of ['gala-sky', 'gala-orbs', 'gala-lights']) expect(root.querySelectorAll(`[data-decor="${n}"]`)).toHaveLength(1);
    expect(root.querySelectorAll('.gala-aurora')).toHaveLength(AURORA.length);
    expect(root.querySelectorAll('.gala-planet')).toHaveLength(1);
    expect(root.querySelectorAll('.gala-orb')).toHaveLength(ORBS.length);
    expect(root.querySelectorAll('.gala-flash')).toHaveLength(CAMERA_FLASHES.length);
    expect(root.querySelectorAll('.gala-meteor')).toHaveLength(METEORS.length);
    expect(root.querySelectorAll('.gala-sweep')).toHaveLength(1);
    // 데스크톱 전용 (1280px 미만은 CSS 로 숨김)
    for (const el of root.querySelectorAll('[data-decor^="gala-"]')) expect(el.classList.contains('gala-lg')).toBe(true);
  });

  it('카메라 플래시: 작은 면적, 각자 다른 주기, 합쳐서 초당 3회 미만 (광과민성 안전)', () => {
    const perSecond = CAMERA_FLASHES.reduce((s, f) => s + 1 / f.dur, 0);
    expect(perSecond).toBeLessThan(1.5);
    expect(new Set(CAMERA_FLASHES.map((f) => f.dur)).size).toBe(CAMERA_FLASHES.length);
    for (const f of CAMERA_FLASHES) {
      expect(f.size).toBeLessThanOrEqual(80);
      expect(f.dur).toBeGreaterThanOrEqual(8);
      expect(f.y).toBeGreaterThan(80); // 객석(지평선 근처)
    }
  });

  it('오브제·렌즈 플레어는 제목 단과 액자 별자리를 피해 놓임', () => {
    for (const o of ORBS) expect(inTitle(o.x, o.y) || inFrames(o.x, o.y)).toBe(false);
    expect(SPARKLES_DESKTOP).toHaveLength(SPARKLES.length);
    for (const s of SPARKLES_DESKTOP) expect(inTitle(s.x, s.y) || inFrames(s.x, s.y)).toBe(false);
  });

  it('갤러리: 데스크톱용 별 마디와 별자리 선, 제목 단 안의 처음 화면으로 버튼', () => {
    const winners = [1, 2, 3].map((n) => ({ id: `w${n}`, display_order: n, name: `이름${n}`, dept: '팀', is_revealed: false as const }));
    const { container } = render(
      <Gallery title="t" subtitle="s" year={2026} winners={winners} opened={new Set()} show onOpen={() => {}} footer={<button type="button">처음 화면으로</button>} />,
    );
    expect(container.querySelectorAll('[data-constellation-node]')).toHaveLength(3);
    expect(container.querySelector('[data-constellation]')).not.toBeNull();
    // 버튼은 두 군데(데스크톱 제목 단 / 그 외 화면 아래) — 각각 xl 에서만·xl 미만에서만 보임
    const homes = [...container.querySelectorAll('button')].filter((b) => b.textContent === '처음 화면으로');
    expect(homes).toHaveLength(2);
    expect(homes[0].parentElement!.className).toContain('xl:block');
    expect(homes[1].parentElement!.className).toContain('xl:hidden');
    // 1·3번(짝수 순번)은 아래로 내려 물결 배치
    const lis = [...container.querySelectorAll('li[data-frame-id]')];
    expect(lis[0].className).toContain('xl:mt-');
    expect(lis[1].className).not.toContain('xl:mt-');
  });

  it('나열 순서 안내: 액자가 보일 때만 화면 아래에 표시', () => {
    const winners = [{ id: 'w1', display_order: 1, name: '가', dept: '팀', is_revealed: false as const }];
    const base = { title: 't', subtitle: 's', year: 2026, opened: new Set<string>(), show: true, onOpen: () => {} };
    const { getByTestId, queryByTestId, rerender } = render(<Gallery {...base} winners={winners} />);
    expect(getByTestId('order-note').textContent).toBe('나열순서는 순위와 무관하며, 제안자 성명의 가나다 순으로 정렬하였습니다.');
    rerender(<Gallery {...base} winners={winners} status={<p>불러오는 중</p>} />);
    expect(queryByTestId('order-note')).toBeNull();
    rerender(<Gallery {...base} winners={[]} />);
    expect(queryByTestId('order-note')).toBeNull();
  });
});
