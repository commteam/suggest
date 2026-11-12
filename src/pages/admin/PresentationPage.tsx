import { Eye, EyeOff, Loader2, Megaphone, MonitorPlay, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { isDemo, provider } from '@/lib/data/provider';
import type { Winner } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useWinnersList } from './useWinners';

export default function PresentationPage() {
  const { winners, error, reload } = useWinnersList();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'all' | 'none'>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error('처리하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!winners)
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> 불러오는 중…
      </div>
    );

  const next = winners.find((w) => !w.is_revealed) ?? null;
  const revealed = winners.filter((w) => w.is_revealed).length;

  const toggle = (w: Winner, v: boolean) =>
    run(`t-${w.id}`, () => provider.saveWinner({ ...w, is_revealed: v }), `${w.name} 님을 ${v ? '공개' : '공개 전'}로 바꿨습니다.`);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="lg:col-span-2">
        <CardTitle
          desc={
            isDemo
              ? '데모 모드: 같은 브라우저에서 열려 있는 공개 화면 탭에 바로 연출됩니다.'
              : '공개 사이트가 열려 있는 모든 브라우저에 실시간(Realtime)으로 연출됩니다.'
          }
          action={
            <Button asChild variant="ghost" size="sm">
              <a href="/" target="_blank" rel="noreferrer">
                <MonitorPlay /> 공개 화면 새 탭으로 열기
              </a>
            </Button>
          }
        >
          <Megaphone className="mr-1.5 inline h-5 w-5 text-accent" aria-hidden />
          발표 모드
        </CardTitle>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-accent/50 bg-[radial-gradient(80%_100%_at_50%_0%,#12307a66,transparent)] p-5">
            <p className="text-sm text-muted">
              공개 {revealed} / 전체 {winners.length}
            </p>
            <p className="mt-2 font-serif text-xl font-bold">
              {next ? (
                <>
                  다음 차례: <span className="text-accent-light">No. {next.display_order}</span> {next.name}
                  <span className="ml-1 text-base font-normal text-muted">{next.dept}</span>
                </>
              ) : (
                '모든 우수자가 공개되었습니다'
              )}
            </p>
            <Button
              variant="primary"
              size="lg"
              className="mt-4 w-full sm:w-auto"
              disabled={!next || !!busy}
              onClick={() => run('next', () => provider.revealNext(), `${next?.name} 님을 공개했습니다.`)}
            >
              {busy === 'next' ? <Loader2 className="animate-spin" /> : <Sparkles />}
              다음 사람 공개
            </Button>
            <p className="mt-2 text-xs text-muted">스포트라이트 → 플래시 → 사진 등장 → 팡파르 순서로 연출됩니다.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={!!busy} onClick={() => setConfirm('all')}>
              <Eye /> 전체 공개
            </Button>
            <Button size="lg" variant="ghost" className="border border-line" disabled={!!busy} onClick={() => setConfirm('none')}>
              <EyeOff /> 전체 비공개
            </Button>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle desc="개별로 공개 여부를 바꿀 수도 있습니다. (개별 전환은 연출 없이 반영)">공개 상태</CardTitle>
        <ul className="divide-y divide-line">
          {winners.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-3">
              <span className="w-8 font-serif font-bold text-accent-light">{w.display_order}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-bold">{w.name}</span>
                <span className="ml-2 text-sm text-muted">{w.dept}</span>
              </span>
              <span className={cn('text-xs font-bold', w.is_revealed ? 'text-accent-light' : 'text-muted')}>
                {w.is_revealed ? '공개' : '공개 전'}
              </span>
              <Switch
                checked={w.is_revealed}
                disabled={!!busy}
                onCheckedChange={(v) => void toggle(w, v)}
                aria-label={`${w.name} 공개 여부`}
              />
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={confirm === 'all'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="전체 공개할까요?"
        description="모든 우수자의 사진과 제안 내용이 공개 화면에 열립니다."
        confirmLabel="전체 공개"
        onConfirm={() => void run('all', () => provider.setAllRevealed(true), '전체 공개했습니다.')}
      />
      <ConfirmDialog
        open={confirm === 'none'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="전체 비공개로 돌릴까요?"
        description="모든 액자가 “공개 전” 상태로 돌아가고, 사진과 제안 내용이 서버에서 내려가지 않습니다."
        confirmLabel="전체 비공개"
        danger
        onConfirm={() => void run('none', () => provider.setAllRevealed(false), '전체 비공개로 바꿨습니다.')}
      />
    </div>
  );
}
