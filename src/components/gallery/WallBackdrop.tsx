import { CinematicSky, FloorGlitter, HorizonGlow, LaserFan, LensSparkles, LightPillars, LightWings } from './CinematicLights';
import { GalaEffects } from './GalaEffects';
import { GalleryLights } from './GalleryLights';
import { ArtDecoCorners, Curtains, FallingConfetti, StageFloor, Trophy, Truss, WallStars } from './StageDecor';

/**
 * 갤러리 무대 배경 — 시상식 오프닝 영상 같은 시네마틱 무대 (아래 → 위):
 * 깊은 우주빛 바탕 · 밤하늘(별·성운) · 아르데코 장식 · 비네팅 · 빛 기둥 · 빛의 날개 · 벽의 별 ·
 * 바닥(격자·반짝이) · 레이저 부채꼴 · 지평선 폭발광 · 무대 조명(빔·입자·플래시) · 렌즈 플레어 ·
 * 트로피 · 커튼 · 트러스/조명 기구 · 컨페티
 * (반복 벽지 무늬·하단 네모 패널 없음)
 * lit=true 가 되면 조명이 1.2초에 걸쳐 켜지고, 장식은 0.3초 간격으로 차례로 나타남(레이저는 지평선에서 뻗어 나감).
 */
export function WallBackdrop({ lit = true }: { lit?: boolean }) {
  return (
    <div aria-hidden className="stage-root pointer-events-none absolute inset-0 overflow-hidden" data-stage-lit={lit ? 'true' : 'false'}>
      {/* 바탕: 지평선 쪽이 밝은 깊은 우주빛 네이비 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 95% at 50% 70%, #11286c 0%, #0a1740 38%, #060c22 70%, #04070f 100%)' }}
      />
      <CinematicSky />
      <ArtDecoCorners />
      {/* 비네팅 (위·아래 살짝 어둡게) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,7,15,0.7)_0%,transparent_16%,transparent_74%,rgba(4,7,15,0.5)_100%)]" />
      <LightPillars />
      <LightWings />
      <WallStars />
      <StageFloor />
      <FloorGlitter />
      <LaserFan />
      <HorizonGlow />
      {/* 데스크톱 전용: 오로라·고리 행성·떠다니는 오브제·서치라이트·별똥별·카메라 플래시 */}
      <GalaEffects />
      {/* 무대 조명: 커튼·트러스·액자 아래 */}
      <GalleryLights lit={lit} />
      <LensSparkles />
      <Trophy side="left" />
      <Trophy side="right" />
      <Curtains />
      {/* 크라운 몰딩 */}
      <div className="stage-molding absolute inset-x-0 top-0 h-3 bg-[linear-gradient(to_bottom,#081a44,#050b1c)] shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      <Truss />
      <FallingConfetti />
    </div>
  );
}
