import { KeyRound, Loader2, Music, Play, Save, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AudioKind } from '@/lib/data/DataProvider';
import { isDemo, provider } from '@/lib/data/provider';
import type { MusicSource } from '@/lib/audio/music/MusicPlayer';
import { sound } from '@/lib/audio/SoundEngine';
import type { AdminSettings, MusicSourceSetting, SiteSettings } from '@/lib/data/types';
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
  'event_title' | 'event_subtitle' | 'year' | 'intro_line' | 'intro_mode' | 'intro_length' | 'sound_default' | 'accent_color'
>;

const pickDraft = (s: AdminSettings): Draft => ({
  event_title: s.event_title,
  event_subtitle: s.event_subtitle,
  year: s.year,
  intro_line: s.intro_line,
  // 예전 설정에서 오프닝을 껐다면 "바로 입장"으로 보여 줌
  intro_mode: s.intro_enabled === false ? 'instant' : s.intro_mode,
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
        <MusicCard key={settings.bgm_url ?? 'none'} settings={settings} />
        <AudioCard kind="fanfare" label="팡파르 효과음" url={settings.fanfare_url} />
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
      // intro_enabled 는 이제 intro_mode 로 대체되어 항상 켬
      setAdminSettingsCache(await provider.updateSettings({ ...d, intro_enabled: true, event_title: d.event_title.trim() }));
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

        <fieldset className="grid gap-4 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-bold text-[#c9d4e8]">입장 연출</legend>
          <div role="radiogroup" aria-label="입장 연출" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['instant', '바로 입장', '입장하기를 누르면 커튼이 약 1.5초 만에 열리고 갤러리가 나타납니다.'],
                ['cinematic', '시네마틱 오프닝', '드럼롤 → 문구 → 골드 점 → 플래시 3회 → 팡파르 후 커튼이 열립니다.'],
              ] as const
            ).map(([v, label, desc]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={d.intro_mode === v}
                onClick={() => set('intro_mode', v)}
                className={cn(
                  'rounded-lg border p-3 text-left',
                  d.intro_mode === v ? 'border-accent bg-accent/10' : 'border-line hover:border-[#33497c]',
                )}
              >
                <span className={cn('block text-sm font-bold', d.intro_mode === v ? 'text-accent-light' : 'text-ink')}>{label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{desc}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={d.sound_default} onCheckedChange={(v) => set('sound_default', v)} aria-label="소리 기본값" />
            음악·효과음 기본 {d.sound_default ? '켜짐' : '꺼짐'}
            <span className="text-xs text-muted">(관람자가 우측 상단에서 바꾼 설정이 우선)</span>
          </label>
          <div className={cn(d.intro_mode !== 'cinematic' && 'hidden')} role="radiogroup" aria-label="시네마틱 오프닝 길이">
            <span className="mb-1.5 block text-sm text-muted">시네마틱 오프닝 길이</span>
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
      <CardTitle desc={kind === 'fanfare' ? '사진 공개 순간 음악 위에 짧게 울립니다. 없으면 합성 팡파르를 사용합니다.' : undefined}>
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
      <p className="mt-2 text-xs text-muted">사용 허가를 받은 음원만 올려 주세요. 최대 10MB{isDemo ? ' (데모 모드는 3MB)' : ''}</p>
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

/** 배경음악: 기본 웅장한 음악 / 업로드한 음악, 음량, 미리듣기 */
function MusicCard({ settings }: { settings: AdminSettings }) {
  const [source, setSource] = useState<MusicSourceSetting>(settings.music_source);
  const [volume, setVolume] = useState(settings.music_volume);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasUpload = !!settings.bgm_url;
  const effective: MusicSourceSetting = source === 'upload' && hasUpload ? 'upload' : 'default';
  const dirty = source !== settings.music_source || Math.abs(volume - settings.music_volume) > 0.001;

  const src = (): MusicSource => (effective === 'upload' && settings.bgm_url ? { kind: 'url', url: settings.bgm_url } : { kind: 'synth' });

  // 미리듣기 중 음량·음원 변경 즉시 반영, 화면을 떠나면 정지
  useEffect(() => {
    sound.setMusicVolume(volume);
  }, [volume]);
  useEffect(() => () => sound.stopMusic(0.4), []);

  const togglePreview = () => {
    if (previewing) {
      sound.stopMusic(0.6);
      setPreviewing(false);
      return;
    }
    sound.unlock();
    sound.setEnabled(true);
    sound.setMusicVolume(volume);
    sound.prepareMusic(src());
    sound.startMusic(src());
    setPreviewing(true);
  };

  const choose = (v: MusicSourceSetting) => {
    setSource(v);
    if (previewing) {
      const next: MusicSource = v === 'upload' && settings.bgm_url ? { kind: 'url', url: settings.bgm_url } : { kind: 'synth' };
      sound.startMusic(next);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      setAdminSettingsCache(await provider.updateSettings({ music_source: effective, music_volume: Math.round(volume * 100) / 100 }));
      toast.success('배경음악 설정을 저장했습니다.');
    } catch (e) {
      toast.error('저장하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type) && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name))
      return toast.error('mp3, wav, ogg, m4a 파일만 올릴 수 있습니다.');
    if (file.size > AUDIO_MAX) return toast.error('음원은 10MB 이하만 올릴 수 있습니다.');
    setUploading(true);
    try {
      const u = await provider.uploadAudio(file, 'bgm');
      if (previewing) {
        sound.stopMusic(0.3);
        setPreviewing(false);
      }
      setAdminSettingsCache(await provider.updateSettings({ bgm_url: u, music_source: 'upload' }));
      toast.success('배경음악을 등록했습니다. “업로드한 음악”으로 설정했습니다.');
    } catch (e) {
      toast.error('음원을 올리지 못했습니다', { description: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  };

  const removeUpload = async () => {
    setUploading(true);
    try {
      if (previewing) {
        sound.stopMusic(0.3);
        setPreviewing(false);
      }
      setAdminSettingsCache(await provider.updateSettings({ bgm_url: null, music_source: 'default' }));
      toast.success('업로드한 음악을 삭제했습니다. 기본 음악을 사용합니다.');
    } catch (e) {
      toast.error('삭제하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardTitle desc="입장하기를 누르면 시작되어 갤러리·상세 화면에서도 계속 반복 재생됩니다. 상세 화면에서는 40%로 줄어듭니다.">
        <Music className="mr-1.5 inline h-4 w-4 text-accent" aria-hidden />
        배경음악
      </CardTitle>

      <div role="radiogroup" aria-label="배경음악 선택" className="grid gap-2">
        {(
          [
            ['default', '기본 웅장한 음악', '사이트에서 직접 합성하는 시상식풍 음악 (약 53초 반복)'],
            ['upload', '업로드한 음악', hasUpload ? '아래에서 올린 mp3를 반복 재생' : '먼저 mp3를 올려 주세요'],
          ] as const
        ).map(([v, label, desc]) => {
          const disabled = v === 'upload' && !hasUpload;
          const checked = effective === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => choose(v)}
              className={cn(
                'rounded-lg border p-3 text-left disabled:opacity-50',
                checked ? 'border-accent bg-accent/10' : 'border-line hover:border-[#33497c]',
              )}
            >
              <span className={cn('block text-sm font-bold', checked ? 'text-accent-light' : 'text-ink')}>{label}</span>
              <span className="mt-0.5 block text-xs text-muted">{desc}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 flex justify-between font-bold text-[#c9d4e8]">
          음량 <span className="font-normal text-muted tabular-nums">{Math.round(volume * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-[var(--c-accent)]"
          aria-label="배경음악 음량"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={togglePreview} aria-pressed={previewing}>
          {previewing ? <Square /> : <Play />}
          {previewing ? '미리듣기 정지' : '미리듣기'}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} 음악 설정 저장
        </Button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-bold text-[#c9d4e8]">음악 파일 올리기 (선택)</p>
        {settings.bgm_url ? (
          <p className="mt-1 text-xs text-muted">업로드한 음악이 있습니다.</p>
        ) : (
          <p className="mt-1 text-xs text-muted">올린 음악이 없으면 기본 웅장한 음악을 사용합니다.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} mp3 올리기
          </Button>
          {settings.bgm_url && (
            <Button type="button" size="sm" variant="ghost" onClick={removeUpload} disabled={uploading}>
              <Trash2 /> 업로드한 음악 삭제
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
          className="sr-only"
          aria-label="배경음악 파일 선택"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-[#c3cfe3]">
          ⚠️ 사내 행사에 사용할 <strong className="text-ink">사용 허가(라이선스)를 받은 음원만</strong> 올려 주세요. 시중 음원·영화
          OST 등 저작권이 있는 곡은 허가 없이 쓸 수 없습니다. 기본 음악은 사이트가 직접 합성하므로 저작권 걱정 없이 쓸 수 있습니다.
          최대 10MB{isDemo ? ' (데모 모드는 3MB)' : ''}.
        </p>
      </div>
    </Card>
  );
}
