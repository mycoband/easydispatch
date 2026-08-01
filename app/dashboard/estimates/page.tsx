import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { formatMoney } from '@/lib/jobs/totals';
import { ESTIMATE_STATUSES } from '@/lib/validations/estimate';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireCompanyModule('estimates');

  const [{ supabase }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const showGbb = Boolean(company.modules.gbb);
  const { q, status } = await searchParams;
  const query = q?.trim() || '';
  const statusFilter = status?.trim() || '';

  let request = supabase
    .from('estimates')
    .select(
      'id, estimate_number, customer_id, customer_name, description, status, total, valid_until, job_id, converted_job_id, created_at, package_id, option_label, is_recommended'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (query) {
    const safe = query.replace(/[%_,]/g, '');
    request = request.or(
      `customer_name.ilike.%${safe}%,estimate_number.ilike.%${safe}%,description.ilike.%${safe}%`
    );
  }
  if (
    statusFilter &&
    ESTIMATE_STATUSES.includes(
      statusFilter as (typeof ESTIMATE_STATUSES)[number]
    )
  ) {
    request = request.eq('status', statusFilter);
  }

  const { data: estimates, error } = await request;

  const jobIds = Array.from(
    new Set(
      (estimates ?? [])
        .flatMap((e) => [e.job_id, e.converted_job_id])
        .filter(Boolean) as string[]
    )
  );

  const { data: jobs } = jobIds.length
    ? await supabase
        .from('jobs')
        .select('id, job_number, customer_name')
        .in('id', jobIds)
    : { data: [] as { id: string; job_number: string | null; customer_name: string | null }[] };

  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Estimates
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Quotes linked to customers and jobs — apply to a job when approved.
          </p>
        </div>
        <div className="flex gap-2">
          {showGbb && (
            <Link
              href="/dashboard/estimates/gbb"
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-100"
            >
              Good / Better / Best
            </Link>
          )}
          <Link
            href="/dashboard/estimates/new"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New estimate
          </Link>
        </div>
      </div>

      <form className="panel flex flex-wrap gap-2 p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search customer, #, description…"
          className="min-w-[220px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {ESTIMATE_STATUSES.map((s) => (
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
              <th className="px-4 py-3 font-medium">Estimate</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Job</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Status
              </th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {(estimates ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-400">
                  No estimates yet.
                </td>
              </tr>
            ) : (
              (estimates ?? []).map((est) => {
                const linkedJobId = est.job_id || est.converted_job_id;
                const job = linkedJobId ? jobMap.get(linkedJobId) : null;
                return (
                  <tr key={est.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/estimates/${est.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {est.estimate_number || est.id.slice(0, 8)}
                      </Link>
                      {est.package_id && est.option_label && (
                        <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-200">
                          {est.option_label}
                          {est.is_recommended ? ' ★' : ''}
                        </span>
                      )}
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">
                        {est.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-800">
                      {est.customer_id ? (
                        <Link
                          href={`/dashboard/customers/${est.customer_id}`}
                          className="hover:text-brand-700 hover:underline"
                        >
                          {est.customer_name || 'Customer'}
                        </Link>
                      ) : (
                        est.customer_name || '—'
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {job ? (
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="font-medium text-ink-800 hover:text-brand-700 hover:underline"
                        >
                          {job.job_number || job.id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                      {est.converted_job_id && (
                        <p className="text-[10px] text-emerald-700">Applied</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="rounded-md bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-200">
                        {est.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(Number(est.total) || 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
