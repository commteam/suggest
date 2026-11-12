/** 딥 네이비 벽지 + 하단 웨인스코트 */
export function WallBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#0a1430',
          backgroundImage: [
            // 다마스크풍 반복 무늬
            'radial-gradient(circle at 50% 50%, rgba(91,141,239,0.07) 0 9px, transparent 10px)',
            'radial-gradient(ellipse 18px 30px at 50% 50%, transparent 0 14px, rgba(91,141,239,0.05) 15px 16px, transparent 17px)',
            // 세로 스트라이프
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 46px)',
          ].join(','),
          backgroundSize: '46px 64px, 46px 64px, auto',
        }}
      />
      {/* 위쪽은 어둡게, 가운데는 조명 */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_35%,rgba(18,48,122,0.35),transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#060b17_0%,transparent_22%,transparent_70%,rgba(6,11,23,0.6)_100%)]" />
      {/* 크라운 몰딩 */}
      <div className="absolute inset-x-0 top-0 h-3 bg-[linear-gradient(to_bottom,#081a44,#050b1c)] shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      {/* 웨인스코트 */}
      <div className="absolute inset-x-0 bottom-0 h-[150px] sm:h-[22vh] sm:min-h-[150px]">
        <div className="h-3 bg-[linear-gradient(to_bottom,#1b2c58,#0a1430_45%,#04070f)] shadow-[0_-2px_10px_rgba(0,0,0,0.5)]" />
        <div className="relative h-full bg-[#04070f]">
          <div className="absolute inset-x-0 top-5 bottom-8 mx-auto flex max-w-6xl gap-4 px-4 sm:gap-6 sm:px-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-[2px] border border-[#13224a] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.6),inset_0_10px_20px_rgba(0,0,0,0.5)]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
