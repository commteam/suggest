import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/StatusMessage';
import { WinnerDetail } from '@/components/detail/WinnerDetail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { provider } from '@/lib/data/provider';
import { MAX_WINNERS, RECOMMENDED_STORY_LENGTH, type RevealedWinner, type WinnerInput } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';
import { countChars } from '@/lib/text/parseStory';
import { cn } from '@/lib/utils';
import { PhotoUploader } from './PhotoUploader';

const EMPTY: WinnerInput = {
  display_order: 1,
  name: '',
  dept: '',
  position: null,
  photo_url: null,
  topic: '',
  as_is: '',
  actions: '',
  to_be: '',
  reflection: '',
  is_revealed: false,
};

const STORY_FIELDS = [
  { key: 'as_is', label: 'AS-IS · 개선 전 상황' },
  { key: 'actions', label: '추진 내용' },
  { key: 'to_be', label: 'TO-BE · 개선 후 모습' },
  { key: 'reflection', label: '진행 소감' },
] as const;

function StoryField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const n = countChars(value);
  const over = n > RECOMMENDED_STORY_LENGTH;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span id={`${id}-count`} className={cn('text-xs tabular-nums', over ? 'text-[#ffd9a8]' : 'text-muted')} aria-live="polite">
          {n} / 권장 {RECOMMENDED_STORY_LENGTH}자
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={4000}
        rows={5}
        aria-describedby={`${id}-count ${id}-hint`}
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        줄바꿈이 그대로 표시되고, “- ”로 시작하는 줄은 글머리표가 됩니다.{over && ' 권장 길이를 넘었습니다. 카드가 길어집니다.'}
      </p>
    </div>
  );
}

export default function WinnerEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const [form, setForm] = useState<WinnerInput | null>(isNew ? null : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    provider
      .listWinners()
      .then((list) => {
        if (!alive) return;
        if (isNew) {
          if (list.length >= MAX_WINNERS) setLoadError(`우수자는 최대 ${MAX_WINNERS}명까지 등록할 수 있습니다.`);
          else setForm({ ...EMPTY, display_order: list.length + 1 });
          return;
        }
        const w = list.find((x) => x.id === id);
        if (!w) setLoadError('해당 우수자를 찾을 수 없습니다. 삭제되었을 수 있습니다.');
        else {
          const { created_at: _c, ...rest } = w;
          setForm(rest);
        }
      })
      .catch((e: unknown) => alive && setLoadError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  const set = <K extends keyof WinnerInput>(k: K, v: WinnerInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '이름을 입력해 주세요.';
    if (!form.dept.trim()) errs.dept = '소속을 입력해 주세요.';
    if (!form.topic.trim()) errs.topic = '제안 주제를 입력해 주세요.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('입력 내용을 확인해 주세요.', { description: Object.values(errs).join(' ') });
      setTab('edit');
      return;
    }
    setSaving(true);
    try {
      const saved = await provider.saveWinner({
        ...form,
        name: form.name.trim(),
        dept: form.dept.trim(),
        position: form.position?.trim() || null,
        topic: form.topic.trim(),
      });
      // 노출 순서 정규화: 지정한 자리에 끼워 넣고 1..N 으로 다시 매김
      const list = await provider.listWinners();
      const others = list.filter((w) => w.id !== saved.id);
      const pos = Math.min(Math.max(saved.display_order - 1, 0), others.length);
      const ids = [...others.slice(0, pos).map((w) => w.id), saved.id, ...others.slice(pos).map((w) => w.id)];
      if (ids.some((wid, i) => list.find((w) => w.id === wid)?.display_order !== i + 1)) await provider.reorderWinners(ids);
      toast.success('저장했습니다. 공개 화면에 바로 반영됩니다.');
      if (isNew) nav(`/admin/winners/${saved.id}`, { replace: true });
    } catch (err) {
      toast.error('저장하지 못했습니다', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loadError)
    return (
      <div className="py-10">
        <ErrorState message={loadError} />
        <p className="mt-6 text-center">
          <Link to="/admin" className="text-muted underline">
            목록으로
          </Link>
        </p>
      </div>
    );
  if (!form)
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> 불러오는 중…
      </div>
    );

  const preview: RevealedWinner = {
    id: form.id ?? 'preview',
    display_order: form.display_order,
    name: form.name || '이름',
    dept: form.dept || '소속',
    position: form.position || null,
    photo_url: form.photo_url,
    topic: form.topic || '제안 주제를 입력하세요',
    as_is: form.as_is,
    actions: form.actions,
    to_be: form.to_be,
    reflection: form.reflection,
    is_revealed: true,
  };

  const fieldErr = (k: string) =>
    errors[k] ? (
      <p id={`err-${k}`} className="mt-1 text-xs text-[#ffc9c2]">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowLeft /> 목록
          </Link>
        </Button>
        <h1 className="font-serif text-xl font-bold">{isNew ? '우수자 추가' : `${form.name} 수정`}</h1>
        <div className="ml-auto flex gap-2 lg:hidden" role="tablist" aria-label="편집/미리보기 전환">
          {(['edit', 'preview'] as const).map((t) => (
            <Button key={t} type="button" role="tab" aria-selected={tab === t} size="sm" variant={tab === t ? 'secondary' : 'ghost'} onClick={() => setTab(t)}>
              {t === 'edit' ? '편집' : '미리보기'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn('space-y-6', tab !== 'edit' && 'hidden lg:block')}>
          <Card className="space-y-4">
            <h2 className="font-serif text-lg font-bold">기본 정보</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-name">이름 *</Label>
                <Input id="f-name" value={form.name} maxLength={50} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby="err-name" />
                {fieldErr('name')}
              </div>
              <div>
                <Label htmlFor="f-position">직급 (선택)</Label>
                <Input id="f-position" value={form.position ?? ''} maxLength={50} onChange={(e) => set('position', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="f-dept">소속 *</Label>
                <Input id="f-dept" value={form.dept} maxLength={100} onChange={(e) => set('dept', e.target.value)} aria-invalid={!!errors.dept} aria-describedby="err-dept" />
                {fieldErr('dept')}
              </div>
              <div>
                <Label htmlFor="f-order">노출 순서</Label>
                <Input
                  id="f-order"
                  type="number"
                  min={1}
                  max={MAX_WINNERS}
                  value={form.display_order}
                  onChange={(e) => set('display_order', Math.max(1, Math.min(MAX_WINNERS, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex h-10 items-center gap-3 text-sm font-bold text-[#c9d4e8]">
                  <Switch checked={form.is_revealed} onCheckedChange={(v) => set('is_revealed', v)} aria-label="공개 여부" />
                  {form.is_revealed ? '공개' : '공개 전'}
                </label>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-bold text-[#c9d4e8]">증명사진</span>
              <PhotoUploader value={form.photo_url} name={form.name} onChange={(v) => set('photo_url', v)} />
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="font-serif text-lg font-bold">제안 내용</h2>
            <div>
              <Label htmlFor="f-topic">제안 주제 *</Label>
              <Input id="f-topic" value={form.topic} maxLength={200} onChange={(e) => set('topic', e.target.value)} aria-invalid={!!errors.topic} aria-describedby="err-topic" />
              {fieldErr('topic')}
            </div>
            {STORY_FIELDS.map((f) => (
              <StoryField key={f.key} label={f.label} value={form[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </Card>
        </div>

        <aside className={cn('lg:sticky lg:top-32 lg:self-start', tab !== 'preview' && 'hidden lg:block')} aria-label="공개 화면 미리보기">
          <div className="overflow-hidden rounded-xl border border-accent/40 bg-bg">
            <p className="border-b border-line px-4 py-2 text-xs font-bold tracking-wider text-muted">공개 화면 미리보기 (실시간)</p>
            <div className="max-h-[calc(100svh-12rem)] overflow-y-auto p-5 sm:p-7">
              <WinnerDetail winner={preview} compact TitleTag="div" />
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-line bg-[#060b17]/92 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="mr-auto hidden text-sm text-muted sm:block">저장하면 공개 화면에 바로 반영됩니다.</span>
        <Button type="submit" variant="primary" size="lg" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          저장
        </Button>
      </div>
    </form>
  );
}
