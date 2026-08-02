import Link from 'next/link';
import { JobTableRow } from '@/components/jobs/JobTableRow';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { requireOffice } from '@/lib/auth';
import { deriveLiveStatus } from '@/lib/jobs/time-tracking';
import { formatMoney } from '@/lib/jobs/totals';
import { JOB_STATUSES } from '@/lib/validations/job';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { supabase } = await requireOffice();
  const { q, status } = await searchParams;
  const query = q?.trim() || '';
  const statusFilter = status?.trim() || '';

  let request = supabase
    .from('jobs')
    .select(
      'id, job_number, customer_name, job_type, status, priority, assigned_to, assigned_to_name, scheduled_start, total, internal_notes, invoice_status, payment_status, drive_started_at, check_in_at, check_out_at'
    )
    .order('created_at', { ascending: false });

  if (query) {
    request = request.or(
      `customer_name.ilike.%${query}%,job_number.ilike.%${query}%,job_type.ilike.%${query}%,assigned_to_name.ilike.%${query}%`
    );
  }
  if (statusFilter && JOB_STATUSES.includes(statusFilter as (typeof JOB_STATUSES)[number])) {
    request = request.eq('status', statusFilter);
  }

  const { data: jobs, error } = await request;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Tickets with diagnosis, line items, tax, and internal notes. Click a
            row to open.
          </p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New job
        </Link>
      </div>

      <form className="panel flex flex-wrap gap-2 p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search customer, job #, type, tech…"
          className="min-w-[220px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Filter
        </button>
        {(query || statusFilter) && (
          <Link
            href="/dashboard/jobs"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Live
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Tech
              </th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">
                Total
              </th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                  No jobs yet. Create a ticket for a customer.
                </td>
              </tr>
            ) : (
              (jobs ?? []).map((job) => (
                <JobTableRow
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900 group-hover:text-brand-700">
                      {job.customer_name || 'Customer'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {job.job_number || job.id.slice(0, 8)} ·{' '}
                      {job.job_type || 'Job'}
                      {job.priority ? ` · ${job.priority}` : ''}
                    </p>
                    {job.internal_notes && (
                      <p className="mt-1 line-clamp-1 text-xs text-amber-800">
                        Internal: {job.internal_notes}
                      </p>
                    )}
                    <div className="mt-1 md:hidden">
                      <LiveStatusBadge status={deriveLiveStatus(job)} />
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <LiveStatusBadge status={deriveLiveStatus(job)} />
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                    {job.assigned_to_name || 'Unassigned'}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-700 xl:table-cell">
                    {formatMoney(Number(job.total) || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-brand-700">
                      Open
                    </span>
                  </td>
                </JobTableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
