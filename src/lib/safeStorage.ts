/**
 * iframe(예: Microsoft Teams 탭) 안에서는 브라우저 정책에 따라
 * localStorage/sessionStorage 접근 자체가 예외를 던지거나(SecurityError),
 * 저장이 막힐 수 있습니다. 그런 경우에도 앱이 멈추지 않도록 메모리 저장소로 대체합니다.
 */
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

export type StorageKind = 'local' | 'session';
const cache: Partial<Record<StorageKind, { storage: Storage; persistent: boolean }>> = {};

/** 실제 저장소를 쓸 수 있는지 시험해 보고, 안 되면 메모리 저장소 */
export function probeStorage(get: () => Storage | undefined): { storage: Storage; persistent: boolean } {
  try {
    const s = get();
    if (!s) throw new Error('no storage');
    const k = '__awards_probe__';
    s.setItem(k, '1');
    const ok = s.getItem(k) === '1';
    s.removeItem(k);
    if (!ok) throw new Error('storage not writable');
    return { storage: s, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

function resolve(kind: StorageKind) {
  if (!cache[kind]) {
    cache[kind] = probeStorage(() =>
      typeof window === 'undefined' ? undefined : kind === 'local' ? window.localStorage : window.sessionStorage,
    );
  }
  return cache[kind]!;
}

export const safeLocalStorage = (): Storage => resolve('local').storage;
export const safeSessionStorage = (): Storage => resolve('session').storage;
/** false 면 이 환경에서는 새로고침/재방문 시 로그인 상태 등이 사라짐 */
export const isLocalStoragePersistent = () => resolve('local').persistent;
