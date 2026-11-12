import { Loader2, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DemoBadge } from '@/components/common/DemoBadge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { isDemo, provider } from '@/lib/data/provider';
import { errorMessage } from '@/lib/errors';

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <p className="eyebrow text-center text-base">Suggestion Awards</p>
        <h1 className="mt-1 text-center font-serif text-2xl font-extrabold">관리자 로그인</h1>
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
