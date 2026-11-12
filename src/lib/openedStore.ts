import { useSyncExternalStore } from 'react';

/** 관람자가 한 번 열어 본 액자 id 목록 (브라우저별 localStorage) */
const KEY = 'awards.opened.v1';
const listeners = new Set<() => void>();
let cache: ReadonlySet<string> | null = null;

function load(): ReadonlySet<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function save(next: Set<string>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* 저장 실패해도 화면 동작에는 영향 없음 */
  }
  listeners.forEach((l) => l());
}

export function markOpened(...ids: string[]) {
  const cur = load();
  if (ids.every((id) => cur.has(id))) return;
  save(new Set([...cur, ...ids]));
}

export function clearOpened() {
  save(new Set());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useOpenedSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, load, load);
}
