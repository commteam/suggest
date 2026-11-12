import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

const field =
  'w-full rounded-lg border border-line bg-[#081128] px-3 text-[0.95rem] text-ink placeholder:text-[#7486a6] transition-colors hover:border-[#33497c] focus:border-accent focus:outline-none aria-[invalid=true]:border-[#e08b80]';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, 'h-10', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[120px] py-2.5 leading-relaxed', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export function Label({ className, ...p }: ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('mb-1.5 block text-sm font-bold text-[#c9d4e8]', className)} {...p} />;
}
