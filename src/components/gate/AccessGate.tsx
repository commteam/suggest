import { KeyRound, Loader2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { GateMode } from '@/lib/data/types';

interface Props {
  mode: GateMode;
  /** 코드 확인 후 입장 (mode=open 이면 code 없이 호출) */
  onEnter: (code: string | null) => Promise<string | null>;
  /** 이미 확인된 코드가 있으면 입력 없이 입장 버튼만 */
  hasCode: boolean;
  notice?: string | null;
  onRecheck?: () => void;
}

/** 입장 버튼 / 접속 코드 입력 / 준비 중 안내 */
export function AccessGate({ mode, onEnter, hasCode, notice, onRecheck }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errId = useId();

  if (mode === 'not_ready') {
    return (
      <div className="mt-8 text-center" role="status">
        <p className="font-serif text-xl font-bold text-ink">발표 준비 중입니다</p>
        <p className="mt-2 text-sm text-[#c3cfe3]">행사 시작 전입니다. 잠시 후 다시 확인해 주세요.</p>
        {onRecheck && (
          <button type="button" onClick={onRecheck} className="btn-ghost mt-5 text-sm">
            다시 확인
          </button>
        )}
      </div>
    );
  }

  const needCode = mode === 'code' && !hasCode;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (needCode && code.trim() === '') {
      setError('접속 코드를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onEnter(needCode ? code.trim() : null);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col items-center gap-4" noValidate>
      {needCode && (
        <div className="w-full max-w-xs">
          <label htmlFor={inputId} className="mb-2 flex items-center justify-center gap-1.5 text-sm text-[#c3cfe3]">
            <KeyRound className="h-4 w-4" aria-hidden /> 접속 코드
          </label>
          <input
            id={inputId}
            type="password"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? errId : undefined}
            placeholder="안내받은 코드를 입력하세요"
            className="w-full rounded-full border border-accent/60 bg-[#050b1c]/85 px-5 py-3 text-center text-base tracking-[0.2em] text-ink placeholder:tracking-normal placeholder:text-[#7f90ad] focus:border-accent focus:outline-none"
          />
        </div>
      )}
      <button type="submit" className="btn-metal min-w-[180px] text-lg" disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
        입장하기
      </button>
      <p id={errId} role="alert" className="min-h-[1.25rem] text-sm text-[#ffd9a8]">
        {error ?? notice ?? ''}
      </p>
    </form>
  );
}
