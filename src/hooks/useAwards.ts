import { useCallback, useEffect, useRef, useState } from 'react';
import { provider } from '@/lib/data/provider';
import type { PresentationEvent, PublicSettings, PublicWinner } from '@/lib/data/types';

export type AwardsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; winners: PublicWinner[] };

function describeError(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return '인터넷 연결이 끊어졌습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  if (e instanceof Error && e.message) return e.message;
  return '데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSettings(await provider.getPublicSettings());
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    provider
      .getPublicSettings()
      .then((s) => alive && setSettings(s))
      .catch((e: unknown) => alive && setError(describeError(e)));
    const off = provider.subscribePresentation((ev) => {
      if (ev.kind === 'refresh') void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [load]);

  return { settings, error, reload: load };
}

/**
 * 공개 우수자 목록 (누구나 조회, 공개 전 인물은 서버가 이름·소속·순서만 내려줌).
 * 발표 이벤트가 오면 다시 불러오고 onEvent 로 알려 줍니다.
 */
export function usePublicWinners(onEvent?: (e: PresentationEvent, winners: PublicWinner[]) => void) {
  const [state, setState] = useState<AwardsState>({ status: 'loading' });
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const fetchWinners = useCallback(async () => {
    try {
      const winners = await provider.getPublicWinners();
      setState({ status: 'ready', winners });
      return winners;
    } catch (e) {
      setState({ status: 'error', message: describeError(e) });
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    provider
      .getPublicWinners()
      .then((winners) => alive && setState({ status: 'ready', winners }))
      .catch((e: unknown) => alive && setState({ status: 'error', message: describeError(e) }));
    const off = provider.subscribePresentation((ev) => {
      void fetchWinners().then((list) => {
        if (list) onEventRef.current?.(ev, list);
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [fetchWinners]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void fetchWinners();
  }, [fetchWinners]);

  return { state, retry };
}
