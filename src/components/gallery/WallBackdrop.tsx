import { GalleryLights } from './GalleryLights';

/**
 * 갤러리 무대 배경: 깊은 네이비 방사형 그라데이션 + 비네팅 + 움직이는 무대 조명 + 바닥.
 * (반복 벽지 무늬·하단 네모 패널 없음) lit=true 가 되면 조명이 1.2초에 걸쳐 켜짐.
 */
export function WallBackdrop({ lit = true }: { lit?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 바탕: 중앙이 약간 밝고 가장자리가 어두운 깊은 네이비 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 38%, #12245a 0%, #0a1430 42%, #060b17 100%)' }}
      />
      {/* 비네팅 (위·아래 어둡게) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#060b17_0%,transparent_22%,transparent_70%,rgba(6,11,23,0.6)_100%)]" />
      {/* 바닥(무대): 위쪽 얇은 하이라이트 + 아래로 갈수록 #04070f, 조명이 은은히 비치는 가로 광택 */}
      <div data-floor className="absolute inset-x-0 bottom-0 h-[110px] sm:h-[16vh] sm:min-h-[120px]">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,16,40,0.92),#04070f_75%)]" />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(48%_100%_at_50%_0%,rgba(219,232,255,0.075),transparent_72%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(219,232,255,0.22)_30%,rgba(219,232,255,0.28)_50%,rgba(219,232,255,0.22)_70%,transparent)]" />
      </div>
      {/* 무대 조명: 바탕·바닥 위, 크라운 몰딩·액자 아래 */}
      <GalleryLights lit={lit} />
      {/* 크라운 몰딩 */}
      <div className="absolute inset-x-0 top-0 h-3 bg-[linear-gradient(to_bottom,#081a44,#050b1c)] shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
    </div>
  );
}
