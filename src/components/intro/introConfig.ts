/**
 * 오프닝 시퀀스 타이밍 상수 (ms). 모든 연출 시점은 이 파일에서만 조정합니다.
 * "입장하기" 클릭 시점이 0 입니다.
 */
export interface IntroTiming {
  /** 드럼롤 시작 (피날레 직전까지 점점 빨라짐) */
  drumrollAt: number;
  /** 어둠 → 스포트라이트가 밝아지기 시작 */
  spotRiseAt: number;
  /** 오프닝 문구 페이드업 */
  headlineAt: number;
  /** 골드 점 첫 점등 */
  dotsAt: number;
  /** 골드 점 간격 */
  dotInterval: number;
  /** 카메라 플래시 3회 (점점 강하게) */
  flashes: ReadonlyArray<{ at: number; intensity: number }>;
  /** 풀 화이트 플래시 + 팡파르 + 색종이 + 커튼 열림 */
  finaleAt: number;
  /** 갤러리 액자 등장 */
  galleryAt: number;
  /** 오프닝 종료 (오버레이 제거) */
  doneAt: number;
}

export const DOT_COUNT = 5;

export const INTRO_TIMING: Record<'standard' | 'short', IntroTiming> = {
  standard: {
    drumrollAt: 0,
    spotRiseAt: 600,
    headlineAt: 1500,
    dotsAt: 4300,
    dotInterval: 440,
    flashes: [
      { at: 6900, intensity: 0.38 },
      { at: 7550, intensity: 0.62 },
      { at: 8150, intensity: 0.88 },
    ],
    finaleAt: 8900,
    galleryAt: 10300,
    doneAt: 13600,
  },
  short: {
    drumrollAt: 0,
    spotRiseAt: 200,
    headlineAt: 400,
    dotsAt: 1800,
    dotInterval: 220,
    flashes: [
      { at: 3000, intensity: 0.38 },
      { at: 3300, intensity: 0.62 },
      { at: 3600, intensity: 0.88 },
    ],
    finaleAt: 4000,
    galleryAt: 5000,
    doneAt: 7200,
  },
};

/** prefers-reduced-motion: 커튼 열림 + 짧은 페이드만 */
export const REDUCED_TIMING = {
  finaleAt: 0,
  galleryAt: 400,
  doneAt: 1800,
};

/** 커튼이 완전히 열리는 데 걸리는 시간 */
export const CURTAIN_OPEN_MS = { normal: 2600, reduced: 900 };
/** 색종이 지속 시간 */
export const CONFETTI_MS = 6500;
/** 갤러리 액자가 차례로 떠오르는 간격 */
export const FRAME_STAGGER_MS = 220;

/** 스포트라이트 밝기 단계 (0~1) */
export const SPOT_LEVEL = { gate: 0.55, dark: 0.12, rising: 0.75, peak: 1 } as const;

/** 발표 모드(관리자 "다음 사람 공개") 수신 연출 */
export const REVEAL_SEQUENCE = { spotlightMs: 1400, flashToPhotoMs: 250, fanfareDelayMs: 350, highlightHoldMs: 4200 };
