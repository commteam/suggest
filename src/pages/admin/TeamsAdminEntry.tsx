import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminSession } from '@/hooks/useAdminSession';
import { rememberTeamsEntry } from './teamsEntry';

/**
 * Teams 개인 탭 진입 경로: /admin?source=teams
 * 로그인 상태면 관리자 화면으로, 아니면 로그인 화면으로 바로 보냅니다.
 */
export default function TeamsAdminEntry() {
  const { state } = useAdminSession();
  useEffect(() => {
    rememberTeamsEntry();
  }, []);

  if (state.status === 'loading')
    return (
      <div role="status" className="flex min-h-[100svh] items-center justify-center gap-2 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Teams 에서 여는 중…
      </div>
    );
  if (state.status === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/admin/login" replace state={{ from: '/admin' }} />;
}
