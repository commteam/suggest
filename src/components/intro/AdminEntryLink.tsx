import { Link } from 'react-router-dom';

/**
 * 첫 화면 하단의 작은 [관리자] 진입 링크.
 * data-skip-music-start: 이 링크를 누를 때는 배경음악 자동 시작을 하지 않음(곧바로 관리자 화면으로 이동하므로)
 */
export function AdminEntryLink() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[95] flex justify-center sm:bottom-4">
      <Link
        to="/admin"
        data-skip-music-start
        className="pointer-events-auto rounded px-2 py-1 text-[11px] tracking-[0.08em] text-muted/70 transition-colors hover:text-ink sm:text-xs"
      >
        [관리자]
      </Link>
    </div>
  );
}
