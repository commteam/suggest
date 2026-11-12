import { useSyncExternalStore } from 'react';
import { safeLocalStorage } from './safeStorage';

/**
 * 관람자가 열어 본 액자 id 목록.
 * 접속(페이지 로드·새로고침)할 때마다 비우고 시작하므로, 접속 중에 연 액자만 공개 상태로 보입니다.
 * (화면 연출일 뿐 보안 기능이 아님 — 공개 전 인물의 정보는 서버가 애초에 내려주지 않음)
 */
const KEY = 'awards.opened.v1';
const listeners = new Set<() => void>();
let cache: ReadonlySet<string> | null = null;

function load(): ReadonlySet<string> {
  if (cache) return cache;
  try {
    const raw = safeLocalStorage().getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function save(next: Set<string>) {
  cache = next;
  try {
    safeLocalStorage().setItem(KEY, JSON.stringify([...next]));
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

/**
 * 새 접속 시작: 이전 접속에서 열어 본 기록을 지웁니다.
 * 저장소 접근이 실패해도 예외 없이 빈 상태로 시작합니다.
 */
export function resetOpenedForNewVisit() {
  cache = new Set();
  try {
    safeLocalStorage().removeItem(KEY);
  } catch {
    /* 저장소를 쓸 수 없어도 빈 상태로 시작 */
  }
}

// 모듈 로드 시점(= 새 접속)에 한 번 초기화. useEffect 에서 하면 첫 렌더에 열린 상태가 잠깐 보이므로 여기서 호출
resetOpenedForNewVisit();

export function clearOpened() {
  save(new Set());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // 다른 탭이 새로 열리며 기록을 지운 것(removeItem → newValue null)은 이 탭의 접속에 반영하지 않음.
    // (예: 발표 화면을 띄워 둔 채 관리자 탭을 열어도 이미 공개한 액자가 물음표로 돌아가지 않도록)
    if (e.key === KEY && e.newValue !== null) {
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
