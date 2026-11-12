import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'text-[#1a1406] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_14px_color-mix(in_oklab,var(--c-accent)_25%,transparent)] [background:var(--g-metal)] hover:brightness-105',
        secondary: 'border border-line bg-[#12204a] text-ink hover:border-accent/60 hover:bg-[#162a5e]',
        ghost: 'text-muted hover:bg-[#12204a] hover:text-ink',
        danger: 'border border-[#7a3b3b] bg-[#2a1216] text-[#ffc9c2] hover:bg-[#3a171c]',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
