import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { useCallback, useId, useRef, useState, type DragEvent } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { Silhouette } from '@/components/gallery/Silhouette';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { provider } from '@/lib/data/provider';
import { errorMessage } from '@/lib/errors';
import { cropAndEncode, PHOTO_INPUT_MAX_BYTES, PHOTO_TYPES } from '@/lib/image/processPhoto';
import { cn } from '@/lib/utils';

interface Props {
  value: string | null;
  name: string;
  onChange: (url: string | null) => void;
}

/** 증명사진: 선택/드래그앤드롭 → 3:4 크롭(확대/이동) → 1200px WebP 업로드 */
export function PhotoUploader({ value, name, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const pick = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error('JPG, PNG, WebP 이미지만 올릴 수 있습니다.');
      return;
    }
    if (file.size > PHOTO_INPUT_MAX_BYTES) {
      toast.error('원본 사진이 너무 큽니다. (25MB 이하)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setSrc(String(reader.result));
    };
    reader.onerror = () => toast.error('사진을 읽지 못했습니다.');
    reader.readAsDataURL(file);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const apply = async () => {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await cropAndEncode(src, area);
      const url = await provider.uploadPhoto(blob);
      onChange(url);
      setSrc(null);
      toast.success('사진을 적용했습니다. 저장을 눌러야 공개 화면에 반영됩니다.');
    } catch (e) {
      toast.error('사진 업로드 실패', { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'flex items-center gap-4 rounded-xl border border-dashed p-3 transition-colors',
          drag ? 'border-accent bg-accent/10' : 'border-line',
        )}
      >
        <div className="w-24 shrink-0 overflow-hidden rounded-md border border-accent/50 bg-[#0b1530]">
          <div className="aspect-[3/4]">
            {value ? <img src={value} alt={`${name || '우수자'} 증명사진`} className="h-full w-full object-cover" /> : <Silhouette />}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-sm text-muted">
          <p className="mb-2">사진을 끌어다 놓거나 선택하세요. 3:4로 자르고 최대 1200px WebP로 저장됩니다.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload /> 사진 선택
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <Trash2 /> 사진 빼기
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          className="sr-only"
          aria-label="증명사진 파일 선택"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <Modal open={!!src} onOpenChange={(o) => !o && !busy && setSrc(null)} title="사진 자르기 (3:4)" description="드래그해서 위치를, 슬라이더로 확대를 조절하세요.">
        <div className="relative h-[min(60vh,440px)] overflow-hidden rounded-lg bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={3 / 4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
              showGrid
            />
          )}
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm text-muted">
          <ImagePlus className="h-4 w-4" aria-hidden />
          확대
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
            aria-label="확대 비율"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setSrc(null)} disabled={busy}>
            취소
          </Button>
          <Button type="button" variant="primary" onClick={apply} disabled={busy || !area}>
            {busy && <Loader2 className="animate-spin" />}
            적용
          </Button>
        </div>
      </Modal>
    </div>
  );
}
