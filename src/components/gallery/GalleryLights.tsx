import { BEAMS } from './galleryBeams';

/** 갤러리 벽 위를 천천히 움직이는 무대 조명 (벽지 위 · 액자 아래) */
export function GalleryLights({ lit }: { lit: boolean }) {
  return (
    <div aria-hidden className="gallery-lights" data-lit={lit ? 'true' : 'false'} data-testid="gallery-lights">
      <div className="gallery-wash" data-light="wash" />
      {BEAMS.map((style, i) => (
        <div key={i} className="gallery-beam" data-light="beam" style={style} />
      ))}
    </div>
  );
}
