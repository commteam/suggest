import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileButton } from '@/components/ui/file-button';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_EXT_LABEL,
  attachmentLink,
  cleanAttachmentName,
  formatBytes,
  validateAttachment,
} from '@/lib/attachment';
import { provider } from '@/lib/data/provider';
import { DEMO_MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_BYTES } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface Props {
  url: string | null;
  name: string | null;
  onChange: (next: { url: string | null; name: string | null }) => void;
}

/** 우수자 첨부 파일 1개: 선택/드래그앤드롭 → 업로드. 공개 화면 상세 맨 아래 "상세 내용 확인하기" 버튼으로 받음 */
export function AttachmentUploader({ url, name, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const maxBytes = provider.mode === 'demo' ? DEMO_MAX_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
  const link = attachmentLink(url, name);

  const pick = async (file: File | undefined | null) => {
    if (!file || busy) return;
    const problem = validateAttachment(file, maxBytes);
    if (problem) {
      toast.error('첨부할 수 없는 파일입니다', { description: problem });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await provider.uploadAttachment(file);
      onChange({ url: uploaded, name: cleanAttachmentName(file.name) });
      setSize(file.size);
      toast.success('파일을 올렸습니다. 저장을 눌러야 공개 화면에 반영됩니다.');
    } catch (e) {
      toast.error('파일을 올리지 못했습니다', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void pick(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        'rounded-xl border border-dashed p-4 transition-colors',
        drag ? 'border-accent bg-accent/10' : 'border-line',
      )}
      data-testid="attachment-uploader"
    >
      {url ? (
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            {link ? (
              <a
                href={link.href}
                download={link.download}
                target={link.newTab ? '_blank' : undefined}
                rel={link.newTab ? 'noopener noreferrer' : undefined}
                className="block truncate font-bold text-ink underline-offset-2 hover:underline"
                data-testid="attachment-name"
              >
                {name || '첨부파일'}
              </a>
            ) : (
              <span className="block truncate font-bold text-ink" data-testid="attachment-name">
                {name || '첨부파일'}
              </span>
            )}
            <span className="text-xs text-muted">{size != null ? `${formatBytes(size)} · ` : ''}첨부됨</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">첨부한 파일이 없습니다. 파일을 이곳에 끌어다 놓거나 아래 버튼으로 고르세요.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <FileButton
          accept={ATTACHMENT_ACCEPT}
          inputLabel="첨부 파일 선택"
          onFile={(f) => void pick(f)}
          disabled={busy}
          variant="secondary"
          size="md"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy ? '올리는 중…' : url ? '파일 바꾸기' : '파일 선택'}
        </FileButton>
        {url && (
          <Button
            type="button"
            size="md"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onChange({ url: null, name: null });
              setSize(null);
            }}
          >
            <Trash2 /> 첨부 빼기
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {ATTACHMENT_EXT_LABEL} · {formatBytes(maxBytes)} 이하 · 1개
        {provider.mode === 'demo' && ' (데모 모드 제한)'}
      </p>
    </div>
  );
}
