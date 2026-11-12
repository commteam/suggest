/** 첫 화면의 "입장하기" 버튼 — 누구나 바로 입장 */
export function EnterButton({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="mt-9 flex justify-center">
      <button type="button" onClick={onEnter} className="btn-metal min-w-[180px] text-lg">
        입장하기
      </button>
    </div>
  );
}
