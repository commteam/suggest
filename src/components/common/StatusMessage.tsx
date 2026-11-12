import { AlertTriangle, Inbox } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card-blue mx-auto max-w-md rounded-xl px-6 py-8 text-center">
      <AlertTriangle aria-hidden className="mx-auto h-8 w-8 text-accent" />
      <p className="mt-3 text-lg font-bold">정보를 불러오지 못했습니다</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn-metal mt-6 !px-6 !py-2 text-sm" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = '아직 등록된 우수자가 없습니다.' }: { message?: string }) {
  return (
    <div role="status" className="card-blue mx-auto max-w-md rounded-xl px-6 py-8 text-center">
      <Inbox aria-hidden className="mx-auto h-8 w-8 text-muted" />
      <p className="mt-3 text-lg font-bold">곧 발표됩니다</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </div>
  );
}
