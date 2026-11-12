import { beforeEach, describe, expect, it } from 'vitest';
import { MockProvider } from './MockProvider';

describe('MockProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('공개 목록은 공개 전 인물의 내용을 내려주지 않음', async () => {
    const p = new MockProvider();
    const list = await p.getPublicWinners();
    const hidden = list.filter((w) => !w.is_revealed);
    expect(hidden.length).toBeGreaterThan(0);
    for (const h of hidden) expect(Object.keys(h).sort()).toEqual(['dept', 'display_order', 'id', 'is_revealed', 'name']);
  });

  it('데모 모드는 게이트를 열어 둠', async () => {
    expect((await new MockProvider().getPublicSettings()).gate).toBe('open');
  });

  it('다음 사람 공개 → 이벤트 발생 + 상태 저장', async () => {
    const p = new MockProvider();
    const events: string[] = [];
    p.subscribePresentation((e) => events.push(e.kind));
    const w = await p.revealNext();
    expect(w?.display_order).toBe(4);
    expect(events).toContain('reveal');
    const after = await p.getPublicWinners();
    expect(after.find((x) => x.id === w!.id)?.is_revealed).toBe(true);
  });

  it('잘못된 백업은 기존 데이터를 지우지 않음', async () => {
    const p = new MockProvider();
    const before = await p.listWinners();
    await expect(p.restoreBackup({ winners: 'x', settings: {} })).rejects.toThrow();
    expect(await p.listWinners()).toEqual(before);
  });

  it('데모 비밀번호 로그인', async () => {
    const p = new MockProvider();
    await expect(p.signIn('', 'wrong')).rejects.toThrow();
    expect((await p.signIn('', 'demo1234')).isAdmin).toBe(true);
    expect(await p.getSession()).not.toBeNull();
  });

  it('최대 10명 제한', async () => {
    const p = new MockProvider();
    const base = (await p.listWinners())[0];
    for (let i = 0; i < 5; i++) await p.saveWinner({ ...base, id: undefined, name: `추가${i}` });
    await expect(p.saveWinner({ ...base, id: undefined, name: '초과' })).rejects.toThrow('최대 10명');
  });
});
