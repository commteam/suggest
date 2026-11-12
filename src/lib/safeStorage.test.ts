import { describe, expect, it } from 'vitest';
import { probeStorage } from './safeStorage';

describe('safeStorage', () => {
  it('정상 저장소는 그대로 사용', () => {
    const r = probeStorage(() => localStorage);
    expect(r.persistent).toBe(true);
    expect(r.storage).toBe(localStorage);
  });

  it('접근 시 예외(iframe 차단)면 메모리 저장소로 대체', () => {
    const r = probeStorage(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(r.persistent).toBe(false);
    r.storage.setItem('a', '1');
    expect(r.storage.getItem('a')).toBe('1');
    expect(r.storage.length).toBe(1);
    r.storage.removeItem('a');
    expect(r.storage.getItem('a')).toBeNull();
  });

  it('쓰기가 막힌 저장소도 메모리로 대체', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(probeStorage(() => broken).persistent).toBe(false);
  });
});
