import { mulberry32 } from './galleryParticles';

/**
 * 시네마틱 배경(CinematicLights.tsx) 도형 데이터. 모두 시드 고정이라 매번 같은 배치.
 * 좌표계
 * - 하늘(별·레이저·날개·기둥): 지평선(바닥 위 가장자리) 위쪽 상자. viewBox 를 늘려 채우므로(preserveAspectRatio none)
 *   선 굵기·점 크기는 vector-effect: non-scaling-stroke 로 화면 픽셀 기준을 유지
 * - 레이저: viewBox "-100 -100 200 100", 원점(0,0) = 지평선 가운데
 */

/** 점 하나: 길이 0 인 선 + 둥근 끝 → 늘어난 좌표계에서도 동그란 점 */
export const dot = (x: number, y: number) => `M${x.toFixed(2)} ${y.toFixed(2)}h0`;

export interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

/** 배경 별: 위쪽일수록 촘촘 */
export function makeStars(count: number, seed = 11): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: rnd() * 100,
    y: Math.pow(rnd(), 1.35) * 96,
    size: 0.8 + Math.pow(rnd(), 2.4) * 1.9,
    alpha: 0.18 + rnd() * 0.55,
  }));
}

/** 반짝이는 큰 별 묶음 (그룹마다 번갈아 깜빡임) */
export function makeTwinkleGroups(groups: number, perGroup: number, seed = 23): Star[][] {
  const rnd = mulberry32(seed);
  return Array.from({ length: groups }, () =>
    Array.from({ length: perGroup }, () => ({
      x: 3 + rnd() * 94,
      y: 2 + Math.pow(rnd(), 1.2) * 80,
      size: 2 + rnd() * 1.6,
      alpha: 0.55 + rnd() * 0.4,
    })),
  );
}

const rad = (d: number) => (d * Math.PI) / 180;
/** 원점에서 각도(지평선 기준, 0=오른쪽 수평, 90=위) 방향으로 len 만큼 */
export const polar = (deg: number, len: number) => [len * Math.cos(rad(deg)), -len * Math.sin(rad(deg))] as const;

/** 파란 레이저 (오른쪽 기준 각도, 왼쪽은 180-각도) */
export const LASER_ANGLES = [29, 35, 41, 47, 53, 59, 66, 74] as const;
/** 가는 보조 레이저 */
export const LASER_FINE_ANGLES = [32, 38, 44, 50, 56, 62.5, 70] as const;
/** 금색 반짝이 빔 (부채꼴: [시작 각도, 끝 각도]) */
export const GOLD_BEAMS = [
  [12, 16.5],
  [19.5, 25],
] as const;
/** 금색 빔 가장자리 번짐 (같은 부채꼴을 양쪽으로 넓힌 것) */
export const GOLD_SOFT = 2.2;
export const LASER_LEN = 260; // 상자 밖까지 뻗게 (흔들려도 끝이 보이지 않도록)

export function laserPath(side: 'left' | 'right', angles: readonly number[]) {
  return angles
    .map((a) => {
      const [x, y] = polar(side === 'right' ? a : 180 - a, LASER_LEN);
      return `M0 0L${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join('');
}

export function goldBeamPath(side: 'left' | 'right', widen = 0) {
  return GOLD_BEAMS.map(([a0, b0]) => {
    const [a, b] = [a0 - widen, b0 + widen];
    const p = (d: number) => polar(side === 'right' ? d : 180 - d, LASER_LEN).map((v) => v.toFixed(1)).join(' ');
    return `M0 0L${p(a)}L${p(b)}Z`;
  }).join('');
}

/** 금색 빔 위의 반짝이 점 */
export function goldGlitter(count: number, seed = 41): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const [a, b] = GOLD_BEAMS[Math.floor(rnd() * GOLD_BEAMS.length)];
    const ang = a + rnd() * (b - a);
    const r = 6 + Math.pow(rnd(), 0.8) * 110; // 원점 가까이 촘촘
    const [x, y] = polar(side > 0 ? ang : 180 - ang, r);
    return { x, y, size: 1.3 + rnd() * 1.9, alpha: 0.4 + rnd() * 0.6 };
  });
}

/** 빛의 날개: 지평선 근처 한 점(C)에서 바깥 가장자리로 퍼지는 곡선 다발 (viewBox 0 0 100 100) */
export function wingCurves(side: 'left' | 'right', count = 14) {
  // 지평선 위 한 점에서 모여 바깥 위로 날개처럼 퍼짐 (참고 이미지 1)
  const C = [34, 99.4];
  const mirror = (x: number) => (side === 'left' ? x : 100 - x);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const endY = 6 + t * 66; // 가장자리 도착 높이
    const c1 = [25 - t * 3, 98.6 - t * 3];
    const c2 = [9 + t * 2, endY + 22 - t * 6];
    return `M${mirror(C[0])} ${C[1]}C${mirror(c1[0]).toFixed(1)} ${c1[1].toFixed(1)} ${mirror(c2[0]).toFixed(1)} ${c2[1].toFixed(1)} ${mirror(-2)} ${endY.toFixed(1)}`;
  });
}

/** 지평선에서 솟는 빛 기둥 */
export const PILLARS = [
  { x: 9, w: 3.2, h: 58 },
  { x: 21, w: 1.6, h: 72 },
  { x: 34, w: 2.6, h: 52 },
  { x: 50, w: 6.5, h: 92 },
  { x: 66, w: 2.4, h: 60 },
  { x: 79, w: 1.8, h: 76 },
  { x: 91, w: 3, h: 54 },
] as const;

/** 렌즈 플레어(십자 + 가로로 긴 아나모픽 줄) — 제목·액자를 피한 가장자리 */
export const SPARKLES = [
  { x: 15, y: 13, size: 58, dur: 5.2, delay: -0.8, hue: 'pink', mobile: true },
  { x: 85, y: 21, size: 46, dur: 6.4, delay: -3.1, hue: 'blue', mobile: true },
  { x: 7, y: 47, size: 40, dur: 4.6, delay: -1.9, hue: 'gold', mobile: false },
  { x: 93, y: 55, size: 52, dur: 5.8, delay: -4.2, hue: 'pink', mobile: false },
  { x: 27, y: 5, size: 34, dur: 7.1, delay: -2.6, hue: 'blue', mobile: true },
] as const;

/** 바닥 반짝이: 지평선 쪽이 촘촘 (원근) */
export function floorGlitter(count: number, seed = 57): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const y = Math.pow(rnd(), 1.9) * 100;
    // 가운데(빛이 떨어지는 곳)일수록 촘촘
    const x = 50 + (rnd() - 0.5) * (40 + y * 0.9) * (rnd() < 0.7 ? 1 : 1.6);
    return { x, y, size: 0.9 + rnd() * 1.6 * (1 - y / 160), alpha: 0.25 + rnd() * 0.6 * (1 - y / 140) };
  });
}

export const CINEMATIC_BUDGET = {
  normal: { stars: 150, twinkleGroups: 2, twinklePerGroup: 14, glitter: 110, floor: 120 },
  low: { stars: 80, twinkleGroups: 2, twinklePerGroup: 8, glitter: 50, floor: 60 },
} as const;

// ---------------------------------------------------------------------------
// 데스크톱 갈라(시안 C) 전용 효과 — 좌표는 화면 % (제목 단: x 8~34%, 액자 별자리: x 38~96% · y 15~72%, 지평선: y 약 89%)
// ---------------------------------------------------------------------------

/** 하늘을 흐르는 오로라 띠 */
export const AURORA = [
  { top: 4, left: 28, w: 62, h: 26, rot: -8, hue: 'violet', dur: 26, delay: -4 },
  { top: 14, left: 52, w: 54, h: 20, rot: 6, hue: 'teal', dur: 34, delay: -15 },
  { top: 0, left: 2, w: 44, h: 22, rot: 10, hue: 'pink', dur: 30, delay: -9 },
] as const;

/** 떠다니는 오브제: 금빛 별 · 크리스털 구슬 · 다이아몬드 (제목·액자를 피한 빈 곳) */
export const ORBS = [
  { kind: 'star', x: 4, y: 80, size: 34, dur: 11, delay: -2 },
  { kind: 'orb', x: 33, y: 12, size: 26, dur: 14, delay: -6 },
  { kind: 'diamond', x: 36, y: 81, size: 22, dur: 12, delay: -3 },
  { kind: 'star', x: 71, y: 7, size: 22, dur: 13, delay: -8 },
  { kind: 'orb', x: 97.5, y: 46, size: 18, dur: 10, delay: -1 },
  { kind: 'diamond', x: 21, y: 7, size: 16, dur: 15, delay: -10 },
  { kind: 'star', x: 62, y: 83, size: 18, dur: 12.5, delay: -5 },
] as const;

/** 객석 카메라 플래시: 지평선 근처에서 짧게 터짐 (요소마다 주기·시점이 달라 전체 약 1초에 1번, 초당 3회 미만) */
export const CAMERA_FLASHES = [
  { x: 6, y: 93, size: 64, dur: 9.4, delay: -1.2 },
  { x: 18, y: 86, size: 46, dur: 12.2, delay: -7.9 },
  { x: 31, y: 95, size: 58, dur: 10.6, delay: -4.4 },
  { x: 44, y: 88, size: 42, dur: 13.4, delay: -11.1 },
  { x: 55, y: 94, size: 70, dur: 8.8, delay: -3.3 },
  { x: 67, y: 86, size: 44, dur: 11.7, delay: -9.6 },
  { x: 79, y: 93, size: 60, dur: 9.9, delay: -6.1 },
  { x: 90, y: 87, size: 48, dur: 12.8, delay: -2.5 },
  { x: 97, y: 95, size: 56, dur: 10.3, delay: -8.4 },
] as const;

/** 추가 별똥별 (기존 1개 + 2개) */
export const METEORS = [
  { top: 6, left: 44, rot: 24, dur: 27, delay: -9 },
  { top: 18, left: 66, rot: 32, dur: 41, delay: -30 },
] as const;

/** 데스크톱 렌즈 플레어 위치 (시안 C) — SPARKLES 와 같은 순서 */
export const SPARKLES_DESKTOP = [
  { x: 14, y: 12 },
  { x: 92, y: 15 },
  { x: 48, y: 84 },
  { x: 87, y: 79 },
  { x: 30, y: 74 },
] as const;
