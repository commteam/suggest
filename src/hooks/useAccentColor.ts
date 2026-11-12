import { useEffect } from 'react';

/** 관리자가 정한 포인트 컬러를 CSS 변수에 반영 */
export function useAccentColor(color: string | null | undefined) {
  useEffect(() => {
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
    document.documentElement.style.setProperty('--c-accent', color);
  }, [color]);
}
