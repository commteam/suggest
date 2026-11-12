import type { CSSProperties } from 'react';

export type BeamVars = CSSProperties & Record<`--${string}`, string>;

/**
 * 서치라이트 빔 4개. 위치·주기(9~18초)·시작 지점·흔들림 폭이 모두 달라 박자가 맞지 않게 흩어져 비춤.
 * 색: 푸른 흰색 + 포인트 컬러 계열, 최대 투명도 0.16~0.22 (screen 블렌드)
 */
export const BEAMS: BeamVars[] = [
  {
    '--beam-x': '12%',
    '--beam-rest': '-8deg',
    '--beam-from': '-26deg',
    '--beam-to': '10deg',
    '--beam-dur': '11s',
    '--beam-delay': '-3s',
    '--beam-color': 'rgba(219, 232, 255, 0.08)',
    '--beam-core': 'rgba(219, 232, 255, 0.2)',
  },
  {
    '--beam-x': '38%',
    '--beam-rest': '-2deg',
    '--beam-from': '16deg',
    '--beam-to': '-20deg',
    '--beam-dur': '15s',
    '--beam-delay': '-9s',
    '--beam-color': 'color-mix(in oklab, var(--c-accent) 7%, transparent)',
    '--beam-core': 'color-mix(in oklab, var(--c-accent) 17%, transparent)',
  },
  {
    '--beam-x': '63%',
    '--beam-rest': '3deg',
    '--beam-from': '-14deg',
    '--beam-to': '22deg',
    '--beam-dur': '9s',
    '--beam-delay': '-1.5s',
    '--beam-color': 'rgba(219, 232, 255, 0.07)',
    '--beam-core': 'rgba(219, 232, 255, 0.18)',
  },
  {
    '--beam-x': '89%',
    '--beam-rest': '8deg',
    '--beam-from': '28deg',
    '--beam-to': '-6deg',
    '--beam-dur': '18s',
    '--beam-delay': '-12s',
    '--beam-color': 'rgba(219, 232, 255, 0.06)',
    '--beam-core': 'color-mix(in oklab, rgba(219, 232, 255, 0.2), var(--c-accent) 22%)',
  },
];
