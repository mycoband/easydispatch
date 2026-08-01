import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  unsent: 'bg-ink-50 text-ink-500 ring-ink-200',
  pending: 'bg-amber-50 text-amber-900 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  reschedule_requested: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const labels: Record<string, string> = {
  unsent: 'Not confirmed',
  pending: 'Confirmation sent',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
};

export function ConfirmationStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const key = status || 'unsent';
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        styles[key] || styles.unsent
      )}
    >
      {labels[key] || key}
    </span>
  );
}
