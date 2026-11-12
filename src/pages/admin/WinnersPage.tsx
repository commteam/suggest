import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Silhouette } from '@/components/gallery/Silhouette';
import { ErrorState } from '@/components/common/StatusMessage';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { provider } from '@/lib/data/provider';
import { MAX_WINNERS, type Winner } from '@/lib/data/types';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useWinnersList } from './useWinners';

function Row({ w, index, onDelete }: { w: Winner; index: number; onDelete: (w: Winner) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-line bg-[#0b1530] p-3 sm:gap-4',
        isDragging && 'relative z-10 border-accent shadow-[0_10px_30px_rgba(0,0,0,0.6)]',
      )}
    >
      <button
        type="button"
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-[#12204a] hover:text-ink active:cursor-grabbing"
        aria-label={`${w.name} 순서 변경 (스페이스로 잡고 화살표로 이동)`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-center font-serif text-lg font-bold text-accent-light">{index + 1}</span>
      <div className="w-11 shrink-0 overflow-hidden rounded border border-accent/40 sm:w-12">
        <div className="aspect-[3/4]">
          {w.photo_url ? <img src={w.photo_url} alt="" className="h-full w-full object-cover" /> : <Silhouette />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">
          {w.name}
          {w.position && <span className="ml-1.5 text-sm font-normal text-muted">{w.position}</span>}
          <span className="ml-2 hidden text-sm font-normal text-muted sm:inline">{w.dept}</span>
        </p>
        <p className="truncate text-sm text-muted sm:hidden">{w.dept}</p>
        <p className="truncate text-sm text-[#c3cfe3]">{w.topic || '제안 주제 미입력'}</p>
      </div>
      <span
        className={cn(
          'hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex',
          w.is_revealed ? 'bg-accent/15 text-accent-light' : 'bg-[#1a2647] text-muted',
        )}
      >
        {w.is_revealed ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
        {w.is_revealed ? '공개' : '공개 전'}
      </span>
      <div className="flex shrink-0 gap-1">
        <Button asChild size="icon" variant="ghost">
          <Link to={`/admin/winners/${w.id}`} aria-label={`${w.name} 수정`}>
            <Pencil />
          </Link>
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(w)} aria-label={`${w.name} 삭제`}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export default function WinnersPage() {
  const { winners, setWinners, error, reload } = useWinnersList();
  const [toDelete, setToDelete] = useState<Winner | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!winners || !over || active.id === over.id) return;
    const from = winners.findIndex((w) => w.id === active.id);
    const to = winners.findIndex((w) => w.id === over.id);
    const next = arrayMove(winners, from, to).map((w, i) => ({ ...w, display_order: i + 1 }));
    const prev = winners;
    setWinners(next);
    setSaving(true);
    try {
      await provider.reorderWinners(next.map((w) => w.id));
      toast.success('순서를 저장했습니다.');
    } catch (e) {
      setWinners(prev);
      toast.error('순서를 저장하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await provider.deleteWinner(toDelete.id);
      toast.success(`${toDelete.name} 님을 삭제했습니다.`);
      await reload();
    } catch (e) {
      toast.error('삭제하지 못했습니다', { description: errorMessage(e) });
    } finally {
      setToDelete(null);
    }
  };

  const full = (winners?.length ?? 0) >= MAX_WINNERS;

  return (
    <Card>
      <CardTitle
        desc={`최대 ${MAX_WINNERS}명. 손잡이를 끌어 노출 순서를 바꿀 수 있습니다.`}
        action={
          <Button asChild={!full} variant="primary" disabled={full}>
            {full ? (
              <span>
                <Plus /> 최대 인원
              </span>
            ) : (
              <Link to="/admin/winners/new">
                <Plus /> 우수자 추가
              </Link>
            )}
          </Button>
        }
      >
        우수자 관리 {winners && <span className="ml-1 text-base font-normal text-muted">({winners.length}명)</span>}
        {saving && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted" aria-label="저장 중" />}
      </CardTitle>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!winners && !error && (
        <ul className="space-y-2" aria-busy="true" aria-label="불러오는 중">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-[74px] animate-pulse rounded-xl bg-[#0b1530]" />
          ))}
        </ul>
      )}
      {winners && winners.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          등록된 우수자가 없습니다. “우수자 추가”로 시작하세요.
        </p>
      )}
      {winners && winners.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={winners.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {winners.map((w, i) => (
                <Row key={w.id} w={w} index={i} onDelete={setToDelete} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="우수자를 삭제할까요?"
        description={
          <>
            <strong className="text-ink">{toDelete?.name}</strong> 님의 정보와 제안 내용이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </>
        }
        confirmLabel="삭제"
        danger
        onConfirm={doDelete}
      />
    </Card>
  );
}
