import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { formatTimestamp } from '@/lib/jobs/time-tracking';
import { requireCompanyModule } from '@/lib/company/require-module';

type RecentJob = {
  id: string;
  job_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  job_type: string | null;
  status: string | null;
  scheduled_start: string | null;
  created_at: string;
};

export default async function CallbacksPage() {
  await requireCompanyModule('callbacks');

  const { supabase } = await requireOffice();

  const since = new Date();
  since.setDate(since.getDate() - 45);

  const [{ data: flagged }, { data: recent }] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_id, customer_name, job_type, status, scheduled_start, is_callback, warranty_flag, created_at'
      )
      .or('is_callback.eq.true,warranty_flag.eq.true,job_type.ilike.%callback%')
      .neq('status', 'Cancelled')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_id, customer_name, job_type, status, scheduled_start, created_at'
      )
      .gte('created_at', since.toISOString())
      .neq('status', 'Cancelled')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const recentJobs = (recent ?? []) as RecentJob[];

  // Detect same customer revisit within 30 days (possible callback)
  const byCustomer = new Map<string, RecentJob[]>();
  for (const job of recentJobs) {
    if (!job.customer_id) continue;
    if (!byCustomer.has(job.customer_id)) byCustomer.set(job.customer_id, []);
    byCustomer.get(job.customer_id)!.push(job);
  }

  const suspected: {
    newer: RecentJob;
    older: RecentJob;
    days: number;
  }[] = [];

  for (const list of byCustomer.values()) {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const newer = sorted[i];
      const older = sorted[i + 1];
      const days = Math.round(
        (new Date(newer.created_at).getTime() -
          new Date(older.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (days > 0 && days <= 30) {
        suspected.push({ newer, older, days });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          Callbacks & warranty
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Flagged jobs and same-site revisits within 30 days
        </p>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="font-semibold text-ink-900">Flagged jobs</h2>
        </div>
        <ul className="divide-y divide-ink-100">
          {(flagged ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-ink-400">
              No callback / warranty flags yet. Mark them on a job.
            </li>
          ) : (
            (flagged ?? []).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-ink-50"
                >
                  <div>
                    <p className="font-medium">{job.customer_name}</p>
                    <p className="text-xs text-ink-500">
                      {job.job_number} · {job.job_type} · {job.status}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-amber-800">
                    {job.is_callback ||
                    (job.job_type || '').toLowerCase().includes('callback')
                      ? 'Callback'
                      : ''}
                    {job.warranty_flag ? ' · Warranty' : ''}
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="font-semibold text-ink-900">
            Possible revisits (auto-detected)
          </h2>
          <p className="text-xs text-ink-500">
            Same customer, second job within 30 days
          </p>
        </div>
        <ul className="divide-y divide-ink-100">
          {suspected.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-ink-400">
              No recent revisits detected.
            </li>
          ) : (
            suspected.slice(0, 40).map(({ newer, older, days }) => (
              <li
                key={`${newer.id}-${older.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{newer.customer_name}</p>
                  <p className="text-xs text-ink-500">
                    {days} days after prior visit ·{' '}
                    <Link
                      href={`/dashboard/jobs/${older.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      prior
                    </Link>{' '}
                    →{' '}
                    <Link
                      href={`/dashboard/jobs/${newer.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      latest
                    </Link>
                  </p>
                </div>
                <p className="text-xs text-ink-400">
                  {formatTimestamp(newer.created_at)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
