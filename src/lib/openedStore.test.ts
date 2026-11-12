import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'awards.opened.v1';

describe('열어 본 액자 기록 (접속마다 초기화)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('모듈 로드(새 접속) 시 이전에 저장된 기록이 지워진다', async () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    const store = await import('./openedStore');
    expect(localStorage.getItem(KEY)).toBeNull();
    // 내부 캐시도 비어 있음: 이미 있던 id 를 다시 열면 새로 추가되어 저장됨
    store.markOpened('a');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['a']);
  });

  it('접속 중 markOpened 한 값은 reset 호출 전까지 유지된다', async () => {
    const store = await import('./openedStore');
    store.markOpened('x');
    store.markOpened('y');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['x', 'y']);
    store.markOpened('x'); // 중복은 그대로
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['x', 'y']);

    store.resetOpenedForNewVisit();
    expect(localStorage.getItem(KEY)).toBeNull();
    store.markOpened('z');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['z']);
  });

  it('저장소 접근이 실패해도 예외 없이 빈 상태로 시작한다', async () => {
    vi.doMock('./safeStorage', () => ({
      safeLocalStorage: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    }));
    const store = await import('./openedStore');
    expect(() => store.resetOpenedForNewVisit()).not.toThrow();
    expect(() => store.markOpened('a')).not.toThrow();
    vi.doUnmock('./safeStorage');
  });
});

describe('다른 탭과의 관계', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('다른 탭이 새로 접속하며 기록을 지워도 이 탭의 공개 상태는 유지, 다른 탭에서 연 액자는 반영', async () => {
    const { act, renderHook } = await import('@testing-library/react');
    const store = await import('./openedStore');
    const { result } = renderHook(() => store.useOpenedSet());
    act(() => store.markOpened('a'));
    expect(result.current.has('a')).toBe(true);

    // 다른 탭이 새로 열림: removeItem → newValue null 인 storage 이벤트
    act(() => {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, oldValue: '["a"]', newValue: null }));
    });
    expect(result.current.has('a')).toBe(true);

    // 다른 탭에서 액자를 열면(기존 동작) 반영
    act(() => {
      localStorage.setItem(KEY, '["a","b"]');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, oldValue: null, newValue: '["a","b"]' }));
    });
    expect(result.current.has('b')).toBe(true);
  });
});
