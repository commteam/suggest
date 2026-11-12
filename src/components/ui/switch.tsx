import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...p }: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-[#0b1530] transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent/80',
        className,
      )}
      {...p}
    >
      <SwitchPrimitive.Thumb className="block h-4.5 w-4.5 translate-x-0.5 rounded-full bg-ink shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}
