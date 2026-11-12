import { ExternalLink, Info, Loader2, LogIn, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DemoBadge } from '@/components/common/DemoBadge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { isDemo, provider } from '@/lib/data/provider';
import { errorMessage } from '@/lib/errors';
import { isLocalStoragePersistent } from '@/lib/safeStorage';
import { cameFromTeams } from './teamsEntry';

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inTeams] = useState(cameFromTeams);
  const [persistent] = useState(isLocalStoragePersistent);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await provider.signIn(email.trim(), password);
      if (!s.isAdmin) {
        setError('로그인했지만 관리자 권한이 없는 계정입니다.');
        await provider.signOut();
        return;
      }
      const from = (loc.state as { from?: string } | null)?.from;
      nav(from && from.startsWith('/admin') ? from : '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[radial-gradient(80%_60%_at_50%_0%,#12307a55,transparent)] px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <DemoBadge inline />
        </div>
        <p className="eyebrow text-center text-xs">Suggestion Awards</p>
        <h1 className="mt-1 text-center text-2xl font-extrabold">관리자 로그인</h1>
        {inTeams && (
          <div role="note" className="mt-6 rounded-xl border border-sky/50 bg-[#081a44]/70 p-4 text-sm leading-relaxed text-[#c3cfe3]">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <Info className="h-4 w-4 text-sky" aria-hidden /> Microsoft Teams 에서 열었습니다
            </p>
            <p className="mt-1.5">
              Teams 앱 안에서는 회사·브라우저 보안 정책에 따라 <strong className="text-ink">로그인 상태가 유지되지 않을 수 있습니다</strong>.
              탭을 다시 열 때마다 로그인해야 하거나 로그인이 되지 않으면, 브라우저 새 창에서 관리해 주세요.
            </p>
            <a
              href="/admin"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-[#12204a] px-3 py-2 text-sm font-bold text-ink hover:border-accent/60"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> 브라우저에서 열기
            </a>
          </div>
        )}
        {!persistent && (
          <div role="alert" className="mt-4 rounded-xl border border-[#7a5a2a] bg-[#2a1d0c]/70 p-4 text-sm leading-relaxed text-[#ffe2b8]">
            <p className="flex items-center gap-1.5 font-bold">
              <TriangleAlert className="h-4 w-4" aria-hidden /> 이 환경에서는 로그인 정보를 저장할 수 없습니다
            </p>
            <p className="mt-1.5">
              브라우저가 이 화면의 저장소 사용을 막고 있습니다. 로그인은 되지만 새로고침하거나 탭을 닫으면 다시 로그인해야 합니다.
              계속 문제가 있으면 브라우저 새 창에서 관리 페이지를 열어 주세요.
            </p>
          </div>
        )}
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-line bg-panel p-6" noValidate>
          {!isDemo && (
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby="login-error"
              required
            />
            {isDemo && <p className="mt-1.5 text-xs text-muted">데모 모드 비밀번호: demo1234</p>}
          </div>
          <p id="login-error" role="alert" className="min-h-[1.25rem] text-sm text-[#ffc9c2]">
            {error}
          </p>
          <Button type="submit" variant="primary" className="w-full" size="lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
            로그인
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-muted underline-offset-4 hover:text-ink hover:underline">
            공개 화면으로
          </Link>
        </p>
      </div>
    </main>
  );
}
