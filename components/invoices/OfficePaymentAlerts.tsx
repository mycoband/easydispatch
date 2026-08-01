import Link from 'next/link';
import { formatTimestamp } from '@/lib/jobs/time-tracking';

export type PaymentAlert = {
  id: string;
  job_id: string | null;
  body: string | null;
  created_at: string;
};

export function OfficePaymentAlerts({ alerts }: { alerts: PaymentAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="panel border-emerald-200 bg-emerald-50/40 p-5">
      <h2 className="font-display text-lg font-semibold text-emerald-950">
        Recent payments
      </h2>
      <p className="mt-0.5 text-sm text-emerald-800/80">
        Automatic · office only (from Stripe webhook)
      </p>
      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-ink-900">{alert.body}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {formatTimestamp(alert.created_at)}
              </p>
            </div>
            {alert.job_id && (
              <Link
                href={`/dashboard/jobs/${alert.job_id}`}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                Open job
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
