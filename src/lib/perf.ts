/**
 * 기기 성능에 따른 파티클 예산 (0.25 ~ 1).
 * devicePixelRatio 가 높고 코어 수가 적은 기기(저가형 모바일)는 줄입니다.
 */
export function particleBudget(): number {
  if (typeof window === 'undefined') return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  let b = 1;
  if (cores <= 2) b *= 0.35;
  else if (cores <= 4) b *= 0.6;
  if (dpr >= 3) b *= 0.7;
  if (small) b *= 0.7;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 2) b *= 0.6;
  return Math.max(0.25, Math.min(1, b));
}

/** 캔버스 렌더링 배율 상한 */
export function canvasDpr(): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, particleBudget() < 0.5 ? 1 : 1.75);
}
