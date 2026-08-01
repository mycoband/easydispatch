import {
  formatShortDate,
  getWarrantyStatus,
  type WarrantyInfo,
} from '@/lib/warranty';

export function WarrantyBadge({ info }: { info: WarrantyInfo }) {
  const status = getWarrantyStatus(info);
  if (!status.label) return null;

  const tone =
    status.tone === 'green'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status.tone === 'amber'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-ink-50 text-ink-600 border-ink-200';

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${tone}`}>
      <p className="font-semibold">{status.label}</p>
      <p className="mt-0.5 text-xs opacity-80">
        Parts thru {formatShortDate(status.partsExpires)} · Labor thru{' '}
        {formatShortDate(status.laborExpires)}
      </p>
      {info.warranty_notes && (
        <p className="mt-1 text-xs">{info.warranty_notes}</p>
      )}
    </div>
  );
}
