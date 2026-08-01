import Link from 'next/link';
import { formatMoney } from '@/lib/jobs/totals';

export type JobEstimateRow = {
  id: string;
  estimate_number: string | null;
  customer_name: string | null;
  description: string | null;
  status: string | null;
  total: number | string | null;
  converted_job_id: string | null;
};

export function JobEstimatesPanel({
  jobId,
  customerName,
  estimates,
  newHref,
  estimateHref,
  canCreate,
  createLabel = 'New estimate',
}: {
  jobId: string;
  customerName?: string | null;
  estimates: JobEstimateRow[];
  newHref: string;
  estimateHref: (id: string) => string;
  canCreate: boolean;
  createLabel?: string;
}) {
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Estimates
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Quotes for this job
            {customerName ? (
              <>
                {' '}
                · <span className="font-medium text-ink-700">{customerName}</span>
              </>
            ) : null}
          </p>
        </div>
        {canCreate && (
          <Link
            href={newHref}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {createLabel}
          </Link>
        )}
      </div>

      {estimates.length === 0 ? (
        <p className="text-sm text-ink-500">
          No estimates linked yet.
          {canCreate ? ' Build one from this job so pricing stays with the work.' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {estimates.map((est) => (
            <li
              key={est.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <Link
                  href={estimateHref(est.id)}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {est.estimate_number || est.id.slice(0, 8)}
                </Link>
                <p className="truncate text-xs text-ink-500">
                  {est.status || 'Draft'}
                  {est.description ? ` · ${est.description}` : ''}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-ink-900">
                  {formatMoney(Number(est.total) || 0)}
                </p>
                {est.converted_job_id ? (
                  <p className="text-[11px] text-emerald-700">Applied to job</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
