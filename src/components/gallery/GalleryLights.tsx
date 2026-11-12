import { useMemo } from 'react';
import { particleBudget } from '@/lib/perf';
import { BEAMS } from './galleryBeams';
import { makeParticles } from './galleryParticles';

/**
 * 갤러리 무대 조명 — "시상식 오프닝 영상" 같은 살아 움직이는 배경 (벽 위 · 액자 아래)
 *  1. 숨 쉬는 중앙 글로우  2. 서치라이트 빔 4개  3. 가로지르는 광원
 *  4. 떠다니는 빛 입자(점 입자 층 + 십자 반짝임)  5. 간헐적 카메라 플래시
 * 모두 CSS transform·opacity 애니메이션(컴포지터에서 동작). lit=true 가 되면 1.2초에 걸쳐 켜짐.
 */
export function GalleryLights({ lit }: { lit: boolean }) {
  const particles = useMemo(() => makeParticles(particleBudget() < 0.5), []);
  return (
    <div aria-hidden className="gallery-lights" data-lit={lit ? 'true' : 'false'} data-testid="gallery-lights">
      <div className="gallery-glow" data-light="glow" />
      {BEAMS.map((style, i) => (
        <div key={i} className="gallery-beam" data-light="beam" style={style} />
      ))}
      <div className="gallery-wash" data-light="wash" />
      <div className="gallery-particles" data-light="particles" data-count={particles.total}>
        {particles.layers.map((l, i) => (
          <div key={`l${i}`} className="gallery-dots" data-particle-layer={l.dots} style={l.style} />
        ))}
        {particles.stars.map((st, i) => (
          <span key={`s${i}`} className="gallery-star" data-particle="star" style={st.style} />
        ))}
      </div>
      <div className="gallery-flash" data-light="flash" />
    </div>
  );
}
