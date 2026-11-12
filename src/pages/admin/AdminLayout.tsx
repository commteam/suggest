import { DatabaseBackup, ExternalLink, LogOut, Megaphone, Settings2, Users } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DemoBadge } from '@/components/common/DemoBadge';
import { Button } from '@/components/ui/button';
import { useAccentColor } from '@/hooks/useAccentColor';
import { provider } from '@/lib/data/provider';
import { cn } from '@/lib/utils';
import { useAdminSettingsStore } from './useAdminSettings';

const NAV = [
  { to: '/admin', end: true, label: '우수자 관리', icon: Users },
  { to: '/admin/settings', label: '연출 설정', icon: Settings2 },
  { to: '/admin/presentation', label: '발표 모드', icon: Megaphone },
  { to: '/admin/backup', label: '가져오기·내보내기', icon: DatabaseBackup },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const { settings } = useAdminSettingsStore();
  useAccentColor(settings?.accent_color);

  useEffect(() => {
    document.title = '관리자 · Suggestion Awards';
    return () => {
      document.title = '2026 SUGGESTION AWARDS · 사내 제안제도 수행 우수자 발표';
    };
  }, []);

  return (
    <div className="min-h-[100svh] bg-[#070d1d]">
      <header className="sticky top-0 z-30 border-b border-line bg-[#060b17]/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl text-accent-light italic">Awards</span>
            <span className="font-serif font-bold">관리자</span>
            <DemoBadge inline />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink /> 미리보기
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await provider.signOut();
                nav('/admin/login');
              }}
            >
              <LogOut /> 로그아웃
            </Button>
          </div>
          <nav aria-label="관리자 메뉴" className="-mx-1 flex w-full flex-wrap gap-1 pb-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                    isActive ? 'bg-[#12204a] text-accent-light' : 'text-muted hover:bg-[#0f1a3a] hover:text-ink',
                  )
                }
              >
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
