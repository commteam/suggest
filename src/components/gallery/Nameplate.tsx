import { cn } from '@/lib/utils';

interface Props {
  order: number;
  title: string;
  subtitle?: string;
  dim?: boolean;
  className?: string;
}

/** 황동 명패 */
export function Nameplate({ order, title, subtitle, dim, className }: Props) {
  return (
    <div
      className={cn('relative mx-auto w-[92%] rounded-[3px] px-3.5 py-1.5 text-center', dim && 'opacity-80', className)}
      style={{
        background: 'var(--g-frame)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 2px rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.55)',
      }}
    >
      <span className="absolute top-1/2 left-1.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2a1f08]/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
      <span className="absolute top-1/2 right-1.5 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2a1f08]/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
      <p className="text-[0.7rem] leading-none font-bold tracking-[0.26em] text-[#2a1d04] uppercase tabular-nums">No. {order}</p>
      <p className="mt-0.5 truncate text-[0.92rem] leading-tight font-extrabold text-[#1c1403] sm:text-base">{title}</p>
      {subtitle && <p className="truncate text-[0.7rem] leading-tight text-[#33260a] sm:text-xs">{subtitle}</p>}
    </div>
  );
}
