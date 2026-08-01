import Link from 'next/link';

export type UnscheduledJob = {
  id: string;
  job_number: string | null;
  customer_name: string | null;
  job_type: string | null;
  priority: string | null;
  status: string | null;
};

export function UnscheduledJobs({ jobs }: { jobs: UnscheduledJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-950">
            Needs a date
          </h2>
          <p className="text-xs text-ink-500">
            Open a job and set scheduled time — or schedule from a calendar day
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {jobs.length}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="block rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-2 text-sm transition hover:border-brand-300"
            >
              <p className="font-medium text-ink-900">
                {job.customer_name || 'Customer'}
              </p>
              <p className="text-xs text-ink-500">
                {job.job_number || job.id.slice(0, 8)} ·{' '}
                {job.job_type || 'Job'} · {job.status}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
