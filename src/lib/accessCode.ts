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
