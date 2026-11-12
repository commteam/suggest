import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { provider } from '@/lib/data/provider';
import type { AdminSettings } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';

/** 관리자 화면 전역 설정 캐시 (레이아웃의 포인트 컬러와 설정 화면이 공유) */
let current: AdminSettings | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function setAdminSettingsCache(s: AdminSettings) {
  current = s;
  emit();
}

export function useAdminSettingsStore() {
  const settings = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setAdminSettingsCache(await provider.getAdminSettings());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    provider
      .getAdminSettings()
      .then((s) => alive && setAdminSettingsCache(s))
      .catch((e: unknown) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, []);

  return { settings, error, reload: load };
}
