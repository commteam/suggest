import { isDemo } from '@/lib/data/provider';
import { cn } from '@/lib/utils';

/** 데모 모드일 때 화면 상단에 표시 (inline=false 이면 상단 가운데 고정) */
export function DemoBadge({ inline = false }: { inline?: boolean }) {
  if (!isDemo) return null;
  return (
    <div className={cn(!inline && 'pointer-events-none fixed top-3 left-1/2 z-[90] -translate-x-1/2')}>
      <span
        role="status"
        title="Supabase 환경 변수가 없어 이 브라우저(localStorage)에만 저장됩니다."
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-sky/60 bg-[#081a44]/85 px-3 py-1 text-xs font-bold tracking-wider whitespace-nowrap text-ink shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sky" />
        데모 모드
      </span>
    </div>
  );
}
