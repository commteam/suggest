import { GalleryLights } from './GalleryLights';
import { Curtains, FallingConfetti, StageFloor, Sunburst, Trophy, Truss, WallStars } from './StageDecor';

/**
 * 갤러리 무대 배경 (아래 → 위):
 * 깊은 네이비 바탕 · 비네팅 · 선버스트/아르데코 장식 · 벽의 별 · 바닥 · 무대 조명(빔·입자) · 트로피 · 커튼 · 트러스/조명 기구 · 컨페티
 * (반복 벽지 무늬·하단 네모 패널 없음)
 * lit=true 가 되면 조명이 1.2초에 걸쳐 켜지고, 장식은 커튼 → 조명 기구 → 월계관 → 바닥 → 입자 순서로 0.3초 간격으로 나타남.
 */
export function WallBackdrop({ lit = true }: { lit?: boolean }) {
  return (
    <div aria-hidden className="stage-root pointer-events-none absolute inset-0 overflow-hidden" data-stage-lit={lit ? 'true' : 'false'}>
      {/* 바탕: 중앙이 약간 밝고 가장자리가 어두운 깊은 네이비 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 38%, #12245a 0%, #0a1430 42%, #060b17 100%)' }}
      />
      <Sunburst />
      {/* 비네팅 (위·아래 어둡게) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#060b17_0%,transparent_22%,transparent_70%,rgba(6,11,23,0.6)_100%)]" />
      <WallStars />
      <StageFloor />
      {/* 무대 조명: 바탕·바닥 위, 커튼·트러스·액자 아래 */}
      <GalleryLights lit={lit} />
      <Trophy side="left" />
      <Trophy side="right" />
      <Curtains />
      {/* 크라운 몰딩 */}
      <div className="absolute inset-x-0 top-0 h-3 bg-[linear-gradient(to_bottom,#081a44,#050b1c)] shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      <Truss />
      <FallingConfetti />
    </div>
  );
}
