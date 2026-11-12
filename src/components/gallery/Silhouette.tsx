import { cn } from '@/lib/utils';

/** 사진이 없거나 공개 전일 때의 인물 실루엣 */
export function Silhouette({ className, pulse = false }: { className?: string; pulse?: boolean }) {
  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', pulse && 'animate-pulse', className)}
      style={{ background: 'radial-gradient(120% 90% at 50% 20%, #1a2d5c 0%, #0b1530 60%, #070d1f 100%)' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 160" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="sil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b4580" />
            <stop offset="1" stopColor="#14244d" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="62" rx="24" ry="28" fill="url(#sil)" />
        <path d="M14 160c2-34 20-52 46-52s44 18 46 52z" fill="url(#sil)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(219,232,255,0.12),transparent)]" />
    </div>
  );
}
