import type { VariantProps } from 'class-variance-authority';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button-variants';

interface Props extends VariantProps<typeof buttonVariants> {
  accept: string;
  /** 스크린 리더용 이름 (예: "증명사진 파일 선택") */
  inputLabel: string;
  onFile: (file: File | undefined) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * 눈에 보이는 "파일 선택" 버튼.
 * 숨긴 input 을 스크립트로 click() 하지 않고 <label for> 로 네이티브 파일 선택창을 엽니다.
 * (Teams 같은 웹뷰/iframe 에서도 사용자 클릭이 그대로 전달되어 안정적)
 */
export function FileButton({ accept, inputLabel, onFile, disabled, className, variant, size, children }: Props) {
  const id = useId();
  return (
    <span className="relative inline-flex">
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={inputLabel}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <label
        htmlFor={id}
        aria-hidden="true"
        className={cn(
          buttonVariants({ variant, size }),
          'pointer-events-none peer-hover:brightness-110 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          disabled && 'opacity-45',
          className,
        )}
      >
        {children}
      </label>
    </span>
  );
}
