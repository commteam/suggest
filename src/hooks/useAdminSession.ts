import { useCallback, useEffect, useState } from 'react';
import { provider } from '@/lib/data/provider';
import { errorMessage } from '@/lib/errors';

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'denied'; email: string | null }
  | { status: 'admin'; email: string | null }
  | { status: 'error'; message: string };

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' });

  const check = useCallback(async () => {
    try {
      const s = await provider.getSession();
      if (!s) setState({ status: 'anon' });
      else setState(s.isAdmin ? { status: 'admin', email: s.email } : { status: 'denied', email: s.email });
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    provider
      .getSession()
      .then((s) => {
        if (!alive) return;
        if (!s) setState({ status: 'anon' });
        else setState(s.isAdmin ? { status: 'admin', email: s.email } : { status: 'denied', email: s.email });
      })
      .catch((e: unknown) => alive && setState({ status: 'error', message: errorMessage(e) }));
    const off = provider.onAuthChange(() => void check());
    return () => {
      alive = false;
      off();
    };
  }, [check]);

  return { state, recheck: check };
}
