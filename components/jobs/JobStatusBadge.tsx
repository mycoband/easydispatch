import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  New: 'bg-sky-50 text-sky-800 ring-sky-200',
  Scheduled: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'In Progress': 'bg-amber-50 text-amber-900 ring-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-ink-100 text-ink-600 ring-ink-200',
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        styles[status] || 'bg-ink-50 text-ink-700 ring-ink-200'
      )}
    >
      {status}
    </span>
  );
}
