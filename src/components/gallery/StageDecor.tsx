import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { particleBudget } from '@/lib/perf';
import { cn } from '@/lib/utils';
import { BEAMS } from './galleryBeams';
import { mulberry32 } from './galleryParticles';

/**
 * 갤러리 무대 장식 (WallBackdrop 에서 조합, Laurel 은 Gallery 제목 옆).
 * - 모두 인라인 SVG/CSS, aria-hidden, pointer-events-none, 액자·글자보다 아래
 * - 움직임은 transform·opacity 만 (index.css 의 stage-* 키프레임). 움직이는 요소에만 data-anim + will-change
 * - 움직임 줄이기(prefers-reduced-motion)에서는 data-anim 을 붙이지 않고, 입자 계열(컨페티·별 반짝임·유성·렌즈 플레어)은 그리지 않음
 * - 입장 연출: 각 층의 --decor-order(0~4) × 0.3초 간격으로 차례로 나타남 (커튼 → 조명 기구 → 월계관 → 바닥 → 입자)
 */

import { DECOR_ORDER, makeConfetti, STAR_PATH, type Vars } from './stageDecorConfig';


const layer = (order: number): Vars => ({ '--decor-order': order });
const anim = (reduce: boolean | null) => (reduce ? {} : { 'data-anim': '' });

/** 금색 그라데이션 정의 (SVG 마다 id 가 겹치지 않게 접두어) */
function GoldDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--c-accent-light)" />
        <stop offset="0.5" stopColor="var(--c-accent)" />
        <stop offset="1" stopColor="var(--c-accent-dark)" />
      </linearGradient>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// ① 좌우 벨벳 커튼
// ---------------------------------------------------------------------------
export function Curtains() {
  const reduce = useReducedMotion();
  return (
    <div className="stage-decor" data-decor="curtains" style={layer(DECOR_ORDER.curtains)}>
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className="stage-curtain" data-side={side} {...anim(reduce)}>
          {/* 안쪽 끝 금색 테두리 */}
          <span className="stage-curtain-edge" />
          {/* 금색 술 장식 (태블릿 이상) */}
          <svg className="stage-tassel" viewBox="0 0 24 64" aria-hidden>
            <GoldDefs id={`tassel-${side}`} />
            <path d="M12 0 V16" stroke={`url(#tassel-${side})`} strokeWidth="1.4" />
            <circle cx="12" cy="19" r="4.2" fill={`url(#tassel-${side})`} />
            <path d="M8.5 22 Q12 25 15.5 22 L18 50 Q12 55 6 50 Z" fill={`url(#tassel-${side})`} opacity="0.9" />
            <path d="M8 27 H16 M7.5 31 H16.5" stroke="#3a2a08" strokeWidth="0.8" opacity="0.5" />
            {[8.5, 10.5, 12.5, 14.5, 16.5].map((x) => (
              <path key={x} d={`M${x} 34 L${x + (x - 12.5) * 0.25} 58`} stroke="#3a2a08" strokeWidth="0.5" opacity="0.35" />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ② 월계관 (제목 양옆 / 모바일은 제목 위 작은 문장 하나)
// ---------------------------------------------------------------------------
/** 가지 하나: 아래(제목 쪽)에서 위로 휘어 올라가는 줄기 + 양쪽으로 번갈아 달린 잎 */
function branchLeaves() {
  const P0 = [54, 98];
  const P1 = [4, 62];
  const P2 = [34, 4];
  const at = (t: number) => {
    const u = 1 - t;
    return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]];
  };
  const tangent = (t: number) => [2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1])];
  const leaves: { x: number; y: number; rot: number; s: number }[] = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t = 0.1 + (i / (N - 1)) * 0.86;
    const [x, y] = at(t);
    const [dx, dy] = tangent(t);
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    const s = 1 - t * 0.35; // 끝으로 갈수록 작게
    leaves.push({ x, y, rot: a + 38, s }, { x, y, rot: a - 38, s });
  }
  return { stem: `M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`, leaves, tip: at(1) };
}
const BRANCH = branchLeaves();

function Branch({ gid }: { gid: string }) {
  return (
    <g>
      <path d={BRANCH.stem} stroke={`url(#${gid})`} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {BRANCH.leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={0}
          cy={0}
          rx={8.5 * l.s}
          ry={3.1 * l.s}
          transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.rot.toFixed(1)}) translate(${(6.5 * l.s).toFixed(2)} 0)`}
          fill={`url(#${gid})`}
        />
      ))}
      <ellipse cx={0} cy={0} rx={6} ry={2.6} transform={`translate(${BRANCH.tip[0]} ${BRANCH.tip[1]}) rotate(-70) translate(4 0)`} fill={`url(#${gid})`} />
    </g>
  );
}

export function Laurel({ side, lit = true, className }: { side: 'left' | 'right' | 'crest'; lit?: boolean; className?: string }) {
  const gid = `laurel-${side}`;
  if (side === 'crest') {
    // 모바일: 두 가지가 아래에서 만나는 작은 문장
    return (
      <svg
        aria-hidden
        className={cn('stage-decor stage-laurel pointer-events-none', className)}
        data-decor="laurel"
        data-lit={lit ? 'true' : 'false'}
        style={layer(DECOR_ORDER.laurel)}
        viewBox="0 0 132 62"
      >
        <GoldDefs id={gid} />
        <g transform="translate(64 58) rotate(-30) scale(0.5) translate(-54 -98)">
          <Branch gid={gid} />
        </g>
        <g transform="translate(68 58) scale(-1 1) rotate(-30) scale(0.5) translate(-54 -98)">
          <Branch gid={gid} />
        </g>
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      className={cn('stage-decor stage-laurel pointer-events-none', className)}
      data-decor="laurel"
      data-lit={lit ? 'true' : 'false'}
      style={layer(DECOR_ORDER.laurel)}
      viewBox="0 0 64 104"
    >
      <GoldDefs id={gid} />
      <g transform={side === 'right' ? 'translate(64 0) scale(-1 1)' : undefined}>
        <Branch gid={gid} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ③ 천장 트러스 + 조명 기구 (빔 시작 위치마다)
// ---------------------------------------------------------------------------
export function Truss() {
  return (
    <div className="stage-decor stage-rig" data-decor="truss" style={layer(DECOR_ORDER.rig)}>
      <svg className="stage-truss" aria-hidden>
        <defs>
          <pattern id="truss-zigzag" width="22" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 13 L11 1 L22 13" stroke="#8d9ab6" strokeWidth="1" fill="none" />
          </pattern>
          <linearGradient id="truss-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#aab6cf" />
            <stop offset="1" stopColor="#4c5873" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="2" fill="url(#truss-metal)" />
        <rect x="0" y="1" width="100%" height="13" fill="url(#truss-zigzag)" opacity="0.7" />
        <rect x="0" y="13" width="100%" height="2" fill="url(#truss-metal)" />
      </svg>
      {BEAMS.map((b, i) => (
        <svg key={i} className="stage-fixture" data-fixture style={{ left: b['--beam-x'] }} viewBox="0 0 28 40" aria-hidden>
          <defs>
            <radialGradient id={`lens-${i}`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor={i === 1 ? 'var(--c-accent-light)' : '#dbe8ff'} />
              <stop offset="1" stopColor="#dbe8ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`can-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#05070d" />
              <stop offset="0.4" stopColor="#262d3d" />
              <stop offset="1" stopColor="#05070d" />
            </linearGradient>
          </defs>
          {/* 클램프 + 요크 */}
          <rect x="11" y="0" width="6" height="5" rx="1" fill="#39435a" />
          <path d="M5 16 V7 H23 V16" stroke="#4a5570" strokeWidth="1.6" fill="none" />
          {/* 원통 */}
          <rect x="7" y="9" width="14" height="22" rx="2.5" fill={`url(#can-${i})`} stroke="#3a4560" strokeWidth="0.6" />
          <rect x="6" y="28" width="16" height="4" rx="1.2" fill="#1a2030" stroke="#55617d" strokeWidth="0.5" />
          {/* 렌즈 글로우 */}
          <circle cx="14" cy="34" r="6" fill={`url(#lens-${i})`} opacity="0.9" />
        </svg>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ④ 아르데코 모서리 장식 + 벽의 큰 별·작은 별 (방사형 광선은 CinematicLights 의 레이저 부채꼴로 대체)
// ---------------------------------------------------------------------------
export function ArtDecoCorners() {
  return (
    <div className="stage-decor" data-decor="deco-corners" style={layer(DECOR_ORDER.laurel)}>
      {(['left', 'right'] as const).map((side) => (
        <svg key={side} className="stage-deco-corner" data-side={side} viewBox="0 0 120 120" aria-hidden>
          <GoldDefs id={`deco-${side}`} />
          <g stroke={`url(#deco-${side})`} fill="none" strokeWidth="1">
            {[28, 52, 76, 100].map((r) => (
              <path key={r} d={`M0 ${r} A${r} ${r} 0 0 0 ${r} 0`} transform="translate(0 0)" />
            ))}
            {[0, 15, 30, 45, 60, 75, 90].map((a) => {
              const rad = (a * Math.PI) / 180;
              return <path key={a} d={`M0 0 L${(112 * Math.cos(rad)).toFixed(1)} ${(112 * Math.sin(rad)).toFixed(1)}`} opacity="0.7" />;
            })}
            <path d="M0 0 L16 16 M16 16 L22 10 M16 16 L10 22" strokeWidth="1.4" />
          </g>
        </svg>
      ))}
    </div>
  );
}


/** 좌우 벽: 큰 별 실루엣 1개 + 작은 별 4개가 느리게 반짝임 */
export function WallStars() {
  const reduce = useReducedMotion();
  const stars = useMemo(() => {
    const rnd = mulberry32(77);
    return (['left', 'right'] as const).flatMap((side) => [
      { side, big: true, x: 3 + rnd() * 3, y: 18 + rnd() * 5, size: 56, dur: 9, delay: -rnd() * 9 },
      ...Array.from({ length: 4 }, (_, i) => ({
        side,
        big: false,
        // 액자 줄(세로 약 35% 아래)과 겹치지 않도록 벽 위쪽, 커튼 가까이
        x: 0.8 + rnd() * 4.5,
        y: 9 + i * 5.5 + rnd() * 3,
        size: 9 + rnd() * 7,
        dur: 4 + rnd() * 4,
        delay: -rnd() * 8,
      })),
    ]);
  }, []);
  if (reduce) return null;
  return (
    <div className="stage-decor stage-wall-stars" data-decor="wall-stars" style={layer(DECOR_ORDER.particles)}>
      {stars.map((s, i) => (
        <svg
          key={i}
          className={s.big ? 'stage-wall-star is-big' : 'stage-wall-star'}
          data-anim=""
          viewBox="0 0 24 24"
          aria-hidden
          style={
            {
              [s.side]: `calc(var(--curtain-w) + ${s.x.toFixed(1)}vw)`,
              top: `${s.y.toFixed(1)}%`,
              width: s.size,
              height: s.size,
              '--tw-dur': `${s.dur.toFixed(1)}s`,
              '--tw-delay': `${s.delay.toFixed(1)}s`,
            } as Vars
          }
        >
          <path
            d={STAR_PATH}
            fill={s.big ? 'none' : 'var(--c-accent-light)'}
            stroke={s.big ? 'var(--c-accent)' : 'none'}
            strokeWidth={s.big ? 0.7 : 0}
          />
        </svg>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⑤ 바닥 무대 (광택 바닥 + 원근 격자 + 빛 웅덩이 + 가로 광택선)
// ---------------------------------------------------------------------------
const FLOOR_LINES = (() => {
  const h: number[] = [];
  for (let i = 1; i <= 7; i++) h.push(Math.pow(i / 7, 1.8) * 100); // 원근: 아래로 갈수록 간격이 넓어짐
  const v: number[] = [];
  for (let i = -9; i <= 9; i++) v.push(i);
  return { h, v };
})();

export function StageFloor() {
  return (
    <div data-floor className="stage-decor stage-floor" data-decor="floor" style={layer(DECOR_ORDER.floor)}>
      <div className="stage-floor-base" />
      <svg className="stage-floor-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g stroke="#dbe8ff" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none">
          {FLOOR_LINES.h.map((y) => (
            <line key={`h${y}`} x1="0" x2="100" y1={y.toFixed(2)} y2={y.toFixed(2)} vectorEffect="non-scaling-stroke" />
          ))}
          {FLOOR_LINES.v.map((i) => (
            <line key={`v${i}`} x1={50 + i * 3.2} y1="0" x2={50 + i * 14} y2="100" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      <div className="stage-floor-pool" />
      <div className="stage-floor-gloss" />
      <div className="stage-floor-edge" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⑥ 떠다니는 장식: 별·리본 컨페티, 유성, 렌즈 플레어
// ---------------------------------------------------------------------------
export function FallingConfetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => makeConfetti(particleBudget() < 0.5), []);
  if (reduce) return null;
  return (
    <div className="stage-decor stage-confetti" data-decor="confetti" data-count={pieces.length} style={layer(DECOR_ORDER.particles)}>
      {pieces.map((p, i) => (
        <span key={i} className="stage-confetti-piece" data-anim="" style={p.style}>
          <svg viewBox="0 0 24 24" width={p.size} height={p.size} aria-hidden>
            {p.kind === 'star' ? (
              <path d={STAR_PATH} fill={p.color} />
            ) : (
              <path d="M2 9 Q7 4 12 9 T22 9 L22 14 Q17 9 12 14 T2 14 Z" fill={p.color} />
            )}
          </svg>
        </span>
      ))}
      {/* 유성: 34초에 한 번, 0.8초 */}
      <span className="stage-shooting-star" data-anim="" />
      {/* 렌즈 플레어: 빔 끝(바닥 근처)을 따라 천천히 이동 */}
      <span className="stage-lens-flare" data-anim="">
        <span />
        <span />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ⑦ 좌우 하단 소품: 트로피 + 별 대좌 실루엣
// ---------------------------------------------------------------------------
export function Trophy({ side }: { side: 'left' | 'right' }) {
  const gid = `trophy-${side}`;
  return (
    <svg className="stage-decor stage-trophy" data-decor="trophy" data-side={side} style={layer(DECOR_ORDER.floor)} viewBox="0 0 80 140" aria-hidden>
      <GoldDefs id={gid} />
      <g fill={`url(#${gid})`}>
        {/* 컵 */}
        <path d="M18 10 H62 V22 Q62 52 40 60 Q18 52 18 22 Z" />
        {/* 손잡이 */}
        <path d="M18 16 Q4 16 6 30 Q8 42 22 44 L22 40 Q12 38 11 30 Q10 21 18 21 Z" />
        <path d="M62 16 Q76 16 74 30 Q72 42 58 44 L58 40 Q68 38 69 30 Q70 21 62 21 Z" />
        {/* 기둥 · 받침 */}
        <path d="M36 60 H44 L46 78 H34 Z" />
        <rect x="28" y="78" width="24" height="6" rx="1.5" />
        {/* 대좌 */}
        <path d="M14 90 H66 L70 140 H10 Z" />
      </g>
      <path d="M40 104 l3.2 7 7.6.6-5.8 5 1.8 7.4-6.8-4-6.8 4 1.8-7.4-5.8-5 7.6-.6z" fill="#0b1430" opacity="0.7" />
      <rect x="14" y="90" width="52" height="3" fill="#ffffff" opacity="0.15" />
    </svg>
  );
}
