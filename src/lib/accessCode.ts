/** 이 탭에서 확인된 접속 코드 (탭을 닫으면 사라짐) */
const KEY = 'awards.access.code';

export function readStoredCode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeCode(code: string | null) {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const SEEN = 'awards.intro.seen';
export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}
export function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN, '1');
  } catch {
    /* ignore */
  }
}
