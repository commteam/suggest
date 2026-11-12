import { Download, Loader2, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { validateBackup } from '@/lib/data/backup';
import { MockProvider } from '@/lib/data/MockProvider';
import { isDemo, provider } from '@/lib/data/provider';
import { errorMessage } from '@/lib/errors';
import { setAdminSettingsCache } from './useAdminSettings';

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; payload: unknown; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const exportJson = async () => {
    setBusy(true);
    try {
      const data = await provider.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `suggestion-awards-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success('JSON 파일로 내보냈습니다.');
    } catch (e) {
      toast.error('내보내지 못했습니다', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const v = validateBackup(payload); // 확인 전에 미리 검사
      setPending({ name: file.name, payload, count: v.winners.length });
    } catch (e) {
      toast.error('가져올 수 없는 파일입니다', {
        description: e instanceof SyntaxError ? 'JSON 형식이 아닙니다.' : errorMessage(e),
      });
    }
  };

  const doImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await provider.restoreBackup(pending.payload);
      setAdminSettingsCache(await provider.getAdminSettings());
      toast.success(`가져오기 완료: 우수자 ${pending.count}명`);
    } catch (e) {
      toast.error('가져오지 못했습니다. 기존 데이터는 그대로입니다.', { description: errorMessage(e) });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle desc="우수자와 연출 설정을 JSON 파일로 저장합니다. (접속 코드는 포함되지 않음)">내보내기</CardTitle>
        <Button variant="primary" onClick={exportJson} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />} JSON 내보내기
        </Button>
      </Card>
      <Card>
        <CardTitle desc="내보낸 JSON 파일로 전체 데이터를 복원합니다. 파일을 먼저 검사한 뒤 확인을 받습니다.">가져오기</CardTitle>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload /> JSON 파일 선택
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="가져올 JSON 파일 선택"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Card>
      {isDemo && provider instanceof MockProvider && (
        <Card className="md:col-span-2">
          <CardTitle desc="이 브라우저에 저장된 데모 데이터를 처음 상태(가상 인물 5명)로 되돌립니다.">데모 데이터 초기화</CardTitle>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            <RotateCcw /> 초기화
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="현재 데이터가 모두 대체됩니다"
        description={
          <>
            <strong className="text-ink">{pending?.name}</strong> 파일의 우수자 {pending?.count}명과 연출 설정으로 현재 데이터를 모두
            바꿉니다. 실패하면 기존 데이터는 그대로 유지됩니다. 계속할까요?
          </>
        }
        confirmLabel="대체하기"
        danger
        onConfirm={() => void doImport()}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="데모 데이터를 초기화할까요?"
        description="수정한 내용과 올린 사진이 모두 사라집니다."
        confirmLabel="초기화"
        danger
        onConfirm={async () => {
          if (provider instanceof MockProvider) provider.resetDemo();
          setAdminSettingsCache(await provider.getAdminSettings());
          toast.success('데모 데이터를 초기화했습니다.');
        }}
      />
    </div>
  );
}
