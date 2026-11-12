import type { CSSProperties } from 'react';

export type BeamVars = CSSProperties & Record<`--${string}`, string>;

/**
 * 서치라이트 빔 설정. 주기·흔들림 폭·시작 지점을 빔마다 다르게 해서 박자가 맞지 않게 흩어져 비춤.
 * 색: 푸른 조명 톤 + 포인트 컬러 계열, 최대 투명도 0.12~0.18 (screen 블렌드)
 */
export const BEAMS: BeamVars[] = [
  {
    '--beam-x': '16%',
    '--beam-rest': '-6deg',
    '--beam-from': '-24deg',
    '--beam-to': '12deg',
    '--beam-dur': '11s',
    '--beam-delay': '-3s',
    '--beam-color': 'rgba(219, 232, 255, 0.07)',
    '--beam-core': 'rgba(219, 232, 255, 0.16)',
  },
  {
    '--beam-x': '52%',
    '--beam-rest': '3deg',
    '--beam-from': '18deg',
    '--beam-to': '-16deg',
    '--beam-dur': '15.5s',
    '--beam-delay': '-8s',
    '--beam-color': 'color-mix(in oklab, var(--c-accent) 6%, transparent)',
    '--beam-core': 'color-mix(in oklab, var(--c-accent) 14%, transparent)',
  },
  {
    '--beam-x': '85%',
    '--beam-rest': '7deg',
    '--beam-from': '-10deg',
    '--beam-to': '26deg',
    '--beam-dur': '9.5s',
    '--beam-delay': '-1.5s',
    '--beam-color': 'rgba(219, 232, 255, 0.06)',
    '--beam-core': 'color-mix(in oklab, rgba(219, 232, 255, 0.15), var(--c-accent) 18%)',
  },
];
