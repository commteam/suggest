import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SoundPrefContext } from './soundPref';
import { sound } from './SoundEngine';

const KEY = 'awards.sound';

function readPref(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/** 효과음 on/off (관람자 선택이 없으면 관리자 기본값 사용) */
export function SoundProvider({ defaultOn, children }: { defaultOn: boolean; children: ReactNode }) {
  const [pref, setPref] = useState<boolean | null>(readPref);
  const enabled = pref ?? defaultOn;

  useEffect(() => {
    sound.setEnabled(enabled);
  }, [enabled]);

  const toggle = useCallback(() => {
    const next = !enabled;
    if (next) sound.unlock();
    setPref(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [enabled]);

  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);
  return <SoundPrefContext.Provider value={value}>{children}</SoundPrefContext.Provider>;
}

