/** 사용자에게 보여 줄 한국어 오류 메시지 */
export function errorMessage(e: unknown, fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return '인터넷 연결이 끊어졌습니다. 연결을 확인해 주세요.';
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}
