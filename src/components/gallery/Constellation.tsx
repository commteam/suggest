import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

type Pt = readonly [number, number];

/** 별 마디 중심: 액자(li) 위쪽 가운데. Frame 의 [data-constellation-node] 위치(-18px, 지름 12px)와 맞춤 */
const NODE_OFFSET_Y = -12;
/** 빛 알갱이 한 바퀴(초)와 한 구간을 지나는 비율 */
const SPARK_CYCLE_MS = 10000;
const SPARK_ACTIVE = 0.22;

/**
 * 데스크톱 별자리 선: 액자 위 별 마디를 순서대로 잇는 금빛 점선 + 그 선을 따라 1번 → 마지막 번으로 흐르는 빛 알갱이.
 * - 위치는 offsetLeft/offsetTop(변형 전 레이아웃)으로 재므로 액자 등장 애니메이션·호버 이동과 무관
 * - 크기가 바뀔 때만 다시 잼(ResizeObserver). 빛 알갱이는 고정 px 값의 transform 애니메이션(Web Animations)이라 컴포지터에서 동작
 * - 1280px 미만에서는 숨김, 움직임 줄이기에서는 빛 알갱이 없음
 */
export function ConstellationLines({ count }: { count: number }) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<Pt[]>([]);

  useEffect(() => {
    const box = svgRef.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const lis = [...box.querySelectorAll<HTMLElement>('li[data-frame-id]')];
      setPts(lis.map((li) => [li.offsetLeft + li.offsetWidth / 2, li.offsetTop + NODE_OFFSET_Y] as const));
    });
    ro.observe(box); // observe 직후 한 번 호출됨
    return () => ro.disconnect();
  }, [count]);

  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return { a, len: Math.hypot(dx, dy), deg: (Math.atan2(dy, dx) * 180) / Math.PI };
  });

  useEffect(() => {
    const host = sparksRef.current;
    if (!host || reduce) return;
    // 데스크톱 레이아웃일 때만 (숨겨진 화면에서 애니메이션을 돌리지 않음)
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 1280px)').matches) return;
    const els = [...host.querySelectorAll<HTMLElement>('[data-spark]')];
    if (!els.length || typeof els[0].animate !== 'function') return;
    const step = SPARK_CYCLE_MS * SPARK_ACTIVE;
    const anims = els.map((el, i) => {
      const { deg, len } = segs[i];
      const at = (d: number) => `rotate(${deg}deg) translateX(${d}px)`;
      return el.animate(
        [
          { transform: at(0), opacity: 0, offset: 0 },
          { transform: at(len * 0.12), opacity: 1, offset: SPARK_ACTIVE * 0.15 },
          { transform: at(len), opacity: 0, offset: SPARK_ACTIVE },
          { transform: at(len), opacity: 0, offset: 1 },
        ],
        { duration: SPARK_CYCLE_MS, delay: i * step, iterations: Infinity, easing: 'ease-in-out' },
      );
    });
    return () => anims.forEach((a) => a.cancel());
    // segs 는 pts 에서 계산되므로 pts 로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, reduce]);

  return (
    <>
      <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block" data-constellation>
        {segs.map((s, i) => (
          <line
            key={i}
            x1={s.a[0]}
            y1={s.a[1]}
            x2={pts[i + 1][0]}
            y2={pts[i + 1][1]}
            stroke="var(--c-accent-light)"
            strokeWidth="1"
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity="0.6"
          />
        ))}
      </svg>
      {!reduce && (
        <div ref={sparksRef} aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
          {segs.map((s, i) => (
            <span key={i} data-spark className="constellation-spark" style={{ left: s.a[0], top: s.a[1] }} />
          ))}
        </div>
      )}
    </>
  );
}
