import { KeyRound, Loader2, Music, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AudioKind } from '@/lib/data/DataProvider';
import { isDemo, provider } from '@/lib/data/provider';
import type { AdminSettings, SiteSettings } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { setAdminSettingsCache, useAdminSettingsStore } from './useAdminSettings';

const PRESETS = [
  { name: '골드', color: '#d9b45a' },
  { name: '실버', color: '#cfd8e6' },
];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const AUDIO_MAX = 10 * 1024 * 1024;

type Draft = Pick<
  SiteSettings,
  'event_title' | 'event_subtitle' | 'year' | 'intro_line' | 'intro_enabled' | 'intro_length' | 'sound_default' | 'accent_color'
>;

const pickDraft = (s: AdminSettings): Draft => ({
  event_title: s.event_title,
  event_subtitle: s.event_subtitle,
  year: s.year,
  intro_line: s.intro_line,
  intro_enabled: s.intro_enabled,
  intro_length: s.intro_length,
  sound_default: s.sound_default,
  accent_color: s.accent_color,
});

export default function SettingsPage() {
  const { settings, error, reload } = useAdminSettingsStore();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!settings)
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> 불러오는 중…
      </div>
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <AccessCodeCard settings={settings} className="lg:col-span-2" />
      <GeneralForm key={JSON.stringify(pickDraft(settings))} settings={settings} />
      <div className="space-y-6">
        <AudioCard kind="fanfare" label="팡파르" url={settings.fanfare_url} />
        <AudioCard kind="bgm" label="갤러리 배경음" url={settings.bgm_url} />
      </div>
    </div>
  );
}

function GeneralForm({ settings }: { settings: AdminSettings }) {
  const [d, setD] = useState<Draft>(() => pickDraft(settings));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // 포인트 컬러는 저장 전에도 관리자 화면에 미리 적용
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(d.accent_color)) document.documentElement.style.setProperty('--c-accent', d.accent_color);
    return () => {
      document.documentElement.style.setProperty('--c-accent', settings.accent_color);
    };
  }, [d.accent_color, settings.accent_color]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!d.event_title.trim()) return toast.error('행사 제목을 입력해 주세요.');
    if (!Number.isInteger(d.year) || d.year < 2000 || d.year > 2100) return toast.error('연도는 2000~2100 사이로 입력해 주세요.');
    if (!/^#[0-9a-fA-F]{6}$/.test(d.accent_color)) return toast.error('포인트 컬러는 #RRGGBB 형식이어야 합니다.');
    setSaving(true);
    try {
      setAdminSettingsCache(await provider.updateSettings({ ...d, event_title: d.event_title.trim() }));
      toast.success('연출 설정을 저장했습니다.');
    } catch (err) {
      toast.error('저장하지 못했습니다', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <CardTitle desc="공개 화면의 제목과 오프닝 연출을 정합니다.">연출 설정</CardTitle>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <Label htmlFor="s-title">행사 제목</Label>
            <Input id="s-title" value={d.event_title} maxLength={120} onChange={(e) => set('event_title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-year">연도</Label>
            <Input id="s-year" type="number" min={2000} max={2100} value={d.year} onChange={(e) => set('year', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label htmlFor="s-sub">부제</Label>
          <Input id="s-sub" value={d.event_subtitle} maxLength={200} onChange={(e) => set('event_subtitle', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-line">오프닝 문구</Label>
          <Input id="s-line" value={d.intro_line} maxLength={200} onChange={(e) => set('intro_line', e.target.value)} />
        </div>

        <fieldset className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-bold text-[#c9d4e8]">오프닝</legend>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={d.intro_enabled} onCheckedChange={(v) => set('intro_enabled', v)} aria-label="오프닝 사용" />
            오프닝 {d.intro_enabled ? '켜짐' : '꺼짐'}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={d.sound_default} onCheckedChange={(v) => set('sound_default', v)} aria-label="효과음 기본값" />
            효과음 기본 {d.sound_default ? '켜짐' : '꺼짐'}
          </label>
          <div className="sm:col-span-2" role="radiogroup" aria-label="오프닝 길이">
            <span className="mb-1.5 block text-sm text-muted">길이</span>
            <div className="flex gap-2">
              {(
                [
                  ['standard', '표준 (약 13초)'],
                  ['short', '짧게 (약 7초)'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={d.intro_length === v}
                  onClick={() => set('intro_length', v)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-bold',
                    d.intro_length === v ? 'border-accent bg-accent/15 text-accent-light' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-bold text-[#c9d4e8]">포인트 컬러</legend>
          <div className="flex flex-wrap items-center gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                onClick={() => set('accent_color', p.color)}
                aria-pressed={d.accent_color.toLowerCase() === p.color}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold',
                  d.accent_color.toLowerCase() === p.color ? 'border-accent text-ink' : 'border-line text-muted',
                )}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.name}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted">
              직접 선택
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(d.accent_color) ? d.accent_color : '#d9b45a'}
                onChange={(e) => set('accent_color', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
                aria-label="포인트 컬러 직접 선택"
              />
              <code className="text-xs">{d.accent_color}</code>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-lg bg-bg p-4">
            <span className="btn-metal !px-5 !py-2 text-sm">미리보기</span>
            <span className="metal-text font-serif text-xl font-extrabold">명예의 전당</span>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} 설정 저장
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AudioCard({ kind, label, url }: { kind: AudioKind; label: string; url: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const field = kind === 'fanfare' ? 'fanfare_url' : 'bgm_url';

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type) && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name))
      return toast.error('mp3, wav, ogg, m4a 파일만 올릴 수 있습니다.');
    if (file.size > AUDIO_MAX) return toast.error('음원은 10MB 이하만 올릴 수 있습니다.');
    setBusy(true);
    try {
      const u = await provider.uploadAudio(file, kind);
      setAdminSettingsCache(await provider.updateSettings({ [field]: u }));
      toast.success(`${label} 음원을 등록했습니다.`);
    } catch (e) {
      toast.error('음원을 올리지 못했습니다', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setAdminSettingsCache(await provider.updateSettings({ [field]: null }));
      toast.success(`${label} 음원을 삭제했습니다. 합성 효과음을 사용합니다.`);
    } catch (e) {
      toast.error('삭제하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle desc={kind === 'fanfare' ? '없으면 합성 팡파르를 사용합니다.' : '갤러리가 열린 뒤 반복 재생됩니다. (선택)'}>
        <Music className="mr-1.5 inline h-4 w-4 text-accent" aria-hidden />
        {label}
      </CardTitle>
      {url ? <audio controls src={url} className="mb-3 w-full" aria-label={`${label} 미리 듣기`} /> : <p className="mb-3 text-sm text-muted">등록된 음원 없음</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} mp3 올리기
        </Button>
        {url && (
          <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={busy}>
            <Trash2 /> 삭제
          </Button>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        type="file"
        accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
        className="sr-only"
        aria-label={`${label} 음원 파일 선택`}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <p className="mt-2 text-xs text-muted">최대 10MB{isDemo ? ' (데모 모드는 3MB)' : ''}</p>
    </Card>
  );
}

function AccessCodeCard({ settings, className }: { settings: AdminSettings; className?: string }) {
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return toast.error('접속 코드는 6자 이상으로 정해 주세요.');
    if (code !== confirm) return toast.error('확인용 코드가 일치하지 않습니다.');
    setBusy(true);
    try {
      await provider.setAccessCode(code.trim());
      setAdminSettingsCache(await provider.getAdminSettings());
      setCode('');
      setConfirm('');
      toast.success('접속 코드를 저장했습니다.', { description: '이미 접속한 관람자는 새 코드를 다시 입력해야 합니다.' });
    } catch (err) {
      toast.error('접속 코드를 저장하지 못했습니다', { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={className}>
      <form onSubmit={submit} noValidate>
        <CardTitle
          desc={
            isDemo
              ? '데모 모드에서는 접속 코드 게이트가 꺼져 있어 코드 없이 입장합니다. (Supabase 모드에서 적용)'
              : '공개 사이트 입구에서 입력하는 코드입니다. 해시로만 저장되며, 코드가 맞아야 서버가 사진과 제안 내용을 내려줍니다.'
          }
          action={
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                settings.access_code_set ? 'bg-accent/15 text-accent-light' : 'bg-[#3a1d14] text-[#ffd9a8]',
              )}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              {isDemo
                ? '데모 모드 — 게이트 꺼짐'
                : settings.access_code_set
                  ? '설정됨'
                  : '미설정 — 공개 사이트가 “준비 중”으로 잠겨 있음'}
            </span>
          }
        >
          접속 코드
        </CardTitle>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="ac-new">{settings.access_code_set ? '새 접속 코드' : '접속 코드 정하기'}</Label>
            <Input id="ac-new" type="password" autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6자 이상" />
          </div>
          <div>
            <Label htmlFor="ac-confirm">코드 확인</Label>
            <Input id="ac-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {settings.access_code_set ? '코드 변경' : '코드 저장'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
