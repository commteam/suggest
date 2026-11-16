import { useReducedMotion } from 'framer-motion';
import { AURORA, CAMERA_FLASHES, METEORS, ORBS } from './cinematicConfig';
import { DECOR_ORDER, STAR_PATH, type Vars } from './stageDecorConfig';

/**
 * 데스크톱(1280px 이상) 갈라 무대 효과 — 시안 C
 * 오로라 띠 · 고리 행성 · 떠다니는 금빛 별·크리스털 구슬 · 하늘을 쓸고 지나가는 서치라이트 · 별똥별 · 객석 카메라 플래시
 * - 1280px 미만은 display:none (모바일·태블릿·작은 노트북 화면은 그대로)
 * - transform·opacity 만 애니메이션, 움직임 줄이기에서는 정지(플래시·별똥별·서치라이트는 그리지 않음)
 */
const layer = (order: number): Vars => ({ '--decor-order': order });

export function GalaEffects() {
  const reduce = useReducedMotion();
  const anim = reduce ? {} : { 'data-anim': '' };
  return (
    <>
      {/* 하늘: 오로라 + 고리 행성 (하늘 층과 함께 등장) */}
      <div className="stage-decor gala-lg" data-decor="gala-sky" style={layer(DECOR_ORDER.curtains)}>
        {AURORA.map((a, i) => (
          <span
            key={i}
            className="gala-aurora"
            data-hue={a.hue}
            {...anim}
            style={
              {
                top: `${a.top}%`,
                left: `${a.left}%`,
                width: `${a.w}vw`,
                height: `${a.h}vh`,
                '--au-rot': `${a.rot}deg`,
                '--au-dur': `${a.dur}s`,
                '--au-delay': `${a.delay}s`,
              } as Vars
            }
          />
        ))}
        <svg className="gala-planet" viewBox="-60 -60 120 120" aria-hidden {...anim}>
          <defs>
            <radialGradient id="planet-body" cx="-0.35" cy="-0.4" r="1.1">
              <stop offset="0" stopColor="#c9b8ff" />
              <stop offset="0.35" stopColor="#5b4fc9" />
              <stop offset="0.8" stopColor="#1d1d5c" />
              <stop offset="1" stopColor="#0b0d2a" />
            </radialGradient>
            <linearGradient id="planet-ring" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--c-accent-light)" stopOpacity="0" />
              <stop offset="0.3" stopColor="var(--c-accent-light)" stopOpacity="0.85" />
              <stop offset="0.7" stopColor="#ff9fd0" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ff9fd0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle r="34" fill="rgba(140,120,255,0.12)" />
          {/* 뒤쪽 고리 → 행성 → 앞쪽 고리 */}
          <path d="M-56 4 A56 14 0 0 1 56 -4" fill="none" stroke="url(#planet-ring)" strokeWidth="2.4" opacity="0.6" transform="rotate(-14)" />
          <circle r="24" fill="url(#planet-body)" />
          <path d="M-14 -20 A24 24 0 0 1 20 -12" fill="none" stroke="#ffe7f4" strokeWidth="1.2" opacity="0.7" />
          <path d="M-56 4 A56 14 0 0 0 56 -4" fill="none" stroke="url(#planet-ring)" strokeWidth="3" transform="rotate(-14)" />
        </svg>
      </div>

      {/* 떠다니는 오브제 */}
      <div className="stage-decor gala-lg" data-decor="gala-orbs" style={layer(DECOR_ORDER.laurel)}>
        {ORBS.map((o, i) => (
          <span
            key={i}
            className="gala-orb"
            data-kind={o.kind}
            {...anim}
            style={
              {
                left: `${o.x}%`,
                top: `${o.y}%`,
                width: o.size,
                height: o.size,
                '--ob-dur': `${o.dur}s`,
                '--ob-delay': `${o.delay}s`,
              } as Vars
            }
          >
            {o.kind === 'star' && (
              <svg viewBox="0 0 24 24" aria-hidden>
                <defs>
                  <linearGradient id={`orb-star-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff4d0" />
                    <stop offset="0.5" stopColor="var(--c-accent-light)" />
                    <stop offset="1" stopColor="var(--c-accent-dark)" />
                  </linearGradient>
                </defs>
                <path d={STAR_PATH} fill={`url(#orb-star-${i})`} />
              </svg>
            )}
            {o.kind === 'diamond' && (
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 1 L22 12 L12 23 L2 12 Z" fill="rgba(200,220,255,0.35)" stroke="#e8f0ff" strokeWidth="0.8" />
                <path d="M12 1 L12 23 M2 12 L22 12" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
              </svg>
            )}
          </span>
        ))}
      </div>

      {/* 움직이는 빛: 서치라이트 · 별똥별 · 카메라 플래시 (입자 층과 함께 등장) */}
      {!reduce && (
        <div className="stage-decor gala-lg" data-decor="gala-lights" style={layer(DECOR_ORDER.particles)}>
          <span className="gala-sweep" data-anim="" />
          {METEORS.map((m, i) => (
            <span
              key={i}
              className="gala-meteor"
              data-anim=""
              style={{ top: `${m.top}%`, left: `${m.left}%`, '--mt-rot': `${m.rot}deg`, '--mt-dur': `${m.dur}s`, '--mt-delay': `${m.delay}s` } as Vars}
            />
          ))}
          {CAMERA_FLASHES.map((f, i) => (
            <span
              key={i}
              className="gala-flash"
              data-anim=""
              style={
                {
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  width: f.size,
                  height: f.size,
                  '--fl-size': `${f.size}px`,
                  '--fl-dur': `${f.dur}s`,
                  '--fl-delay': `${f.delay}s`,
                } as Vars
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
