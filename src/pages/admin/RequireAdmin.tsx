import { Loader2, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/common/StatusMessage';
import { Button } from '@/components/ui/button';
import { useAdminSession } from '@/hooks/useAdminSession';
import { provider } from '@/lib/data/provider';

/** 로그인 + 관리자 역할(user_roles) 확인. 실제 권한은 서버 RLS 가 강제합니다. */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { state, recheck } = useAdminSession();
  const loc = useLocation();

  if (state.status === 'loading')
    return (
      <div role="status" className="flex min-h-[100svh] items-center justify-center gap-2 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> 로그인 상태 확인 중…
      </div>
    );
  if (state.status === 'anon') return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  if (state.status === 'error')
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-4">
        <ErrorState message={state.message} onRetry={recheck} />
      </div>
    );
  if (state.status === 'denied')
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-4">
        <div role="alert" className="max-w-md rounded-xl border border-line bg-panel p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-accent" aria-hidden />
          <p className="mt-3 text-lg font-bold">관리자 권한이 없습니다</p>
          <p className="mt-2 text-sm text-muted">
            {state.email ?? '이 계정'}은 관리자로 지정되지 않았습니다. 관리자 지정 방법은 README 의 체크리스트를 확인하세요.
          </p>
          <Button className="mt-6" onClick={() => void provider.signOut()}>
            다른 계정으로 로그인
          </Button>
        </div>
      </div>
    );
  return <>{children}</>;
}
