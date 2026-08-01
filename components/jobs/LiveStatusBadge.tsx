import { cn } from '@/lib/utils';
import type { LiveStatus } from '@/lib/jobs/time-tracking';

const styles: Record<LiveStatus, string> = {
  New: 'bg-sky-50 text-sky-800 ring-sky-200',
  Scheduled: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'En Route': 'bg-violet-50 text-violet-900 ring-violet-200',
  'On Site': 'bg-amber-50 text-amber-950 ring-amber-300',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-ink-100 text-ink-600 ring-ink-200',
  Unassigned: 'bg-ink-50 text-ink-700 ring-ink-200',
};

export function LiveStatusBadge({ status }: { status: LiveStatus }) {
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
