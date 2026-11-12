import { useCallback, useEffect, useState } from 'react';
import { provider } from '@/lib/data/provider';
import type { Winner } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';

export function useWinnersList() {
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setWinners(await provider.listWinners());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    provider
      .listWinners()
      .then((w) => alive && setWinners(w))
      .catch((e: unknown) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, []);

  return { winners, setWinners, error, reload };
}
