import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { particleBudget } from '@/lib/perf';
import {
  CINEMATIC_BUDGET,
  dot,
  floorGlitter,
  goldBeamPath,
  GOLD_SOFT,
  goldGlitter,
  laserPath,
  LASER_ANGLES,
  LASER_FINE_ANGLES,
  makeStars,
  makeTwinkleGroups,
  PILLARS,
  SPARKLES,
  wingCurves,
} from './cinematicConfig';
import { DECOR_ORDER, type Vars } from './stageDecorConfig';

/**
 * 시네마틱 무대 조명 (시상식 오프닝 영상 느낌) — WallBackdrop 에서 조합
 * 별이 흐르는 밤하늘 + 성운 · 지평선에서 솟는 빛 기둥 · 양옆 빛의 날개 · 지평선에서 부채꼴로 퍼지는 레이저와 금빛 반짝이 빔 ·
 * 지평선 빛줄기와 중앙 폭발광, 가로지르는 아나모픽 플래시 · 렌즈 플레어 · 반짝이는 바닥
 * - 인라인 SVG/CSS 만, aria-hidden, 클릭 통과, 액자·글자보다 아래
 * - 움직임은 transform·opacity 만. 움직이는 요소에만 data-anim (움직임 줄이기에서는 붙이지 않음 → 정지된 빛만)
 * - 등장: 하늘(0) → 기둥(1) → 날개(2) → 지평선·레이저(3, 레이저는 지평선에서 뻗어 나가며 켜짐) → 플레어(4)
 */

const layer = (order: number): Vars => ({ '--decor-order': order });
const anim = (reduce: boolean | null) => (reduce ? {} : { 'data-anim': '' });
const useLow = () => useMemo(() => particleBudget() < 0.5, []);

/** ① 밤하늘: 성운 + 별 + 반짝이는 큰 별 묶음 */
export function CinematicSky() {
  const reduce = useReducedMotion();
  const low = useLow();
  const b = low ? CINEMATIC_BUDGET.low : CINEMATIC_BUDGET.normal;
  const stars = useMemo(() => makeStars(b.stars), [b.stars]);
  const groups = useMemo(() => makeTwinkleGroups(b.twinkleGroups, b.twinklePerGroup), [b.twinkleGroups, b.twinklePerGroup]);
  return (
    <div className="stage-decor cine-sky" data-decor="cine-sky" style={layer(DECOR_ORDER.curtains)}>
      <div className="cine-nebula" />
      <svg className="cine-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g stroke="#e6eeff" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          {stars.map((s, i) => (
            <path key={i} d={dot(s.x, s.y)} strokeWidth={s.size} strokeOpacity={s.alpha} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      {groups.map((g, gi) => (
        <svg key={gi} className="cine-fill cine-twinkle" data-group={gi} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden {...anim(reduce)}>
          <g strokeLinecap="round">
            {g.map((s, i) => (
              <g key={i}>
                <path d={dot(s.x, s.y)} stroke="#9fc0ff" strokeWidth={s.size * 4} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" />
                <path d={dot(s.x, s.y)} stroke="#ffffff" strokeWidth={s.size} strokeOpacity={s.alpha} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}

/** ② 지평선에서 솟는 빛 기둥 (홀짝 두 무리가 번갈아 밝아짐 — 움직이는 요소 수를 줄이려고 기둥마다가 아니라 무리 단위로) */
export function LightPillars() {
  const reduce = useReducedMotion();
  return (
    <div className="stage-decor cine-sky" data-decor="cine-pillars" style={layer(DECOR_ORDER.rig)}>
      {[0, 1].map((g) => (
        <div key={g} className="cine-pillar-group" data-group={g} {...anim(reduce)}>
          {PILLARS.filter((_, i) => i % 2 === g).map((p) => (
            <span
              key={p.x}
              className="cine-pillar"
              data-center={p.x === 50 ? '' : undefined}
              style={{ left: `${p.x}%`, width: `${p.w}vw`, height: `${p.h}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** ③ 양옆 빛의 날개 (가는 곡선 다발, 홀짝 줄이 번갈아 빛남) */
export function LightWings() {
  const reduce = useReducedMotion();
  return (
    <div className="stage-decor cine-sky cine-wings" data-decor="cine-wings" style={layer(DECOR_ORDER.laurel)}>
      {(['left', 'right'] as const).map((side) => {
        const curves = wingCurves(side);
        const gid = `wing-${side}`;
        return (
          <div key={side} className="cine-wing" data-side={side}>
            {[0, 1].map((half) => (
              <svg key={half} className="cine-fill cine-wing-half" data-half={half} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden {...anim(reduce)}>
                <defs>
                  <linearGradient id={`${gid}-${half}`} x1={side === 'left' ? '1' : '0'} y1="1" x2={side === 'left' ? '0' : '1'} y2="0.2">
                    <stop offset="0" stopColor="#ffe2a0" stopOpacity="1" />
                    <stop offset="0.3" stopColor="#ff9fd0" stopOpacity="0.7" />
                    <stop offset="0.7" stopColor="#9f86ff" stopOpacity="0.45" />
                    <stop offset="1" stopColor="#6aa0ff" stopOpacity="0.15" />
                  </linearGradient>
                </defs>
                <g fill="none" stroke={`url(#${gid}-${half})`} strokeWidth="1.1" vectorEffect="non-scaling-stroke">
                  {curves
                    .filter((_, i) => i % 2 === half)
                    .map((d, i) => (
                      <path key={i} d={d} vectorEffect="non-scaling-stroke" />
                    ))}
                </g>
              </svg>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** ④ 레이저 부채꼴: 파란 레이저(좌·우가 반대로 천천히 쓸어 줌) + 금빛 반짝이 빔 */
export function LaserFan() {
  const reduce = useReducedMotion();
  const low = useLow();
  const glitter = useMemo(() => goldGlitter(low ? CINEMATIC_BUDGET.low.glitter : CINEMATIC_BUDGET.normal.glitter), [low]);
  return (
    <div className="stage-decor cine-sky" data-decor="cine-lasers" style={layer(DECOR_ORDER.floor)}>
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className="cine-fan-open" data-side={side}>
          <svg className="cine-fill cine-fan" data-side={side} viewBox="-100 -100 200 100" preserveAspectRatio="none" aria-hidden {...anim(reduce)}>
            <defs>
              <radialGradient id={`laser-${side}`} cx="0" cy="0" r="125" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#eaf2ff" stopOpacity="0.95" />
                <stop offset="0.25" stopColor="#7fb0ff" stopOpacity="0.7" />
                <stop offset="0.7" stopColor="#4f7dff" stopOpacity="0.25" />
                <stop offset="1" stopColor="#4f7dff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g fill="none" stroke={`url(#laser-${side})`} strokeLinecap="round">
              {/* 번짐(넓고 옅게) + 심(가늘고 밝게) — blur 필터 없이 레이저 광채 */}
              <path d={laserPath(side, LASER_ANGLES)} strokeWidth="7" strokeOpacity="0.14" vectorEffect="non-scaling-stroke" />
              <path d={laserPath(side, LASER_ANGLES)} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              <path d={laserPath(side, LASER_FINE_ANGLES)} strokeWidth="0.8" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
        </div>
      ))}
      <div className="cine-fan-open" data-side="gold">
        <svg className="cine-fill cine-gold" viewBox="-100 -100 200 100" preserveAspectRatio="none" aria-hidden {...anim(reduce)}>
          <defs>
            <radialGradient id="gold-beam" cx="0" cy="0" r="120" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fff1c8" stopOpacity="1" />
              <stop offset="0.14" stopColor="#ffcc5e" stopOpacity="0.75" />
              <stop offset="0.45" stopColor="#ffa236" stopOpacity="0.3" />
              <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* 바깥 번짐 + 심 (가장자리가 부드러운 금빛 빔) */}
          <path d={goldBeamPath('left', GOLD_SOFT) + goldBeamPath('right', GOLD_SOFT)} fill="url(#gold-beam)" opacity="0.35" />
          <path d={goldBeamPath('left') + goldBeamPath('right')} fill="url(#gold-beam)" />
          <g stroke="#ffe9a8" strokeLinecap="round">
            {glitter.map((s, i) => (
              <path key={i} d={dot(s.x, s.y)} strokeWidth={s.size} strokeOpacity={s.alpha} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** ⑤ 지평선: 빛줄기 + 분홍·파랑 번짐 + 중앙 폭발광 + 렌즈 플레어 + 가로지르는 아나모픽 플래시 */
export function HorizonGlow() {
  const reduce = useReducedMotion();
  return (
    <div className="stage-decor cine-horizon" data-decor="cine-horizon" style={layer(DECOR_ORDER.floor)}>
      <span className="cine-horizon-haze" />
      <span className="cine-burst" {...anim(reduce)} />
      <span className="cine-horizon-line" />
      <span className="cine-core-flare" {...anim(reduce)}>
        <span />
      </span>
      {!reduce && <span className="cine-sweep" data-anim="" />}
    </div>
  );
}

/** ⑥ 렌즈 플레어 반짝임 (십자 + 아나모픽 가로줄) */
export function LensSparkles() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="stage-decor cine-sparkles" data-decor="cine-sparkles" style={layer(DECOR_ORDER.particles)}>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="cine-sparkle"
          data-hue={s.hue}
          data-mobile={s.mobile ? '' : undefined}
          data-anim=""
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              '--sp-size': `${s.size}px`,
              '--sp-dur': `${s.dur}s`,
              '--sp-delay': `${s.delay}s`,
            } as Vars
          }
        >
          <span />
        </span>
      ))}
    </div>
  );
}

/** ⑦ 반짝이는 바닥 (지평선 쪽이 촘촘한 금·은 반짝이, 두 무리가 번갈아 반짝) */
export function FloorGlitter() {
  const reduce = useReducedMotion();
  const low = useLow();
  const pts = useMemo(() => floorGlitter(low ? CINEMATIC_BUDGET.low.floor : CINEMATIC_BUDGET.normal.floor), [low]);
  return (
    <div className="stage-decor cine-floor" data-decor="cine-floor" style={layer(DECOR_ORDER.floor)}>
      <span className="cine-floor-reflect" />
      {[0, 1].map((half) => (
        <svg key={half} className="cine-fill cine-glitter" data-half={half} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden {...anim(reduce)}>
          <g strokeLinecap="round">
            {pts
              .filter((_, i) => i % 2 === half)
              .map((s, i) => (
                <path
                  key={i}
                  d={dot(s.x, s.y)}
                  stroke={i % 3 === 0 ? '#dbe8ff' : 'var(--c-accent-light)'}
                  strokeWidth={s.size}
                  strokeOpacity={s.alpha}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
