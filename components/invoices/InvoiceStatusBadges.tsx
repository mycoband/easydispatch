import { cn } from '@/lib/utils';

export function InvoiceStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const value = status || 'Not Sent';
  const styles =
    value === 'Sent'
      ? 'bg-sky-50 text-sky-800 ring-sky-200'
      : 'bg-ink-50 text-ink-700 ring-ink-200';

  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        styles
      )}
    >
      {value}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const value = status || 'Unpaid';
  const styles =
    value === 'Paid'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : value === 'Partial'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : 'bg-ink-50 text-ink-700 ring-ink-200';

  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        styles
      )}
    >
      {value}
    </span>
  );
}
