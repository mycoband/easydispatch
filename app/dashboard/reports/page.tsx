import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { formatMoney } from '@/lib/jobs/totals';
import { requireCompanyModuleAndPermission } from '@/lib/company/require-module';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportsDateFilter } from '@/components/reports/ReportsDateFilter';
import { AskReports } from '@/components/reports/AskReports';

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const [y, m, day] = value.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function agingBucket(invoiceSentAt: string | null, now: Date) {
  if (!invoiceSentAt) return 'current';
  const age = daysBetween(new Date(invoiceSentAt), now);
  if (age <= 30) return '0-30';
  if (age <= 60) return '31-60';
  if (age <= 90) return '61-90';
  return '90+';
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireCompanyModuleAndPermission('reports', 'view_reports');
  const [{ supabase, profile }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const params = await searchParams;
  const showCosting =
    company.modules.job_costing &&
    roleHasPermission(profile.role, 'view_job_costs', company.role_permissions);
  const showAskAi = company.modules.ai;

  const defaultFrom = startOfMonth();
  const defaultTo = new Date();
  const from = parseDateParam(params.from, defaultFrom);
  const to = endOfDay(parseDateParam(params.to, defaultTo));
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const now = new Date();

  const [
    periodJobsRes,
    { data: unpaid },
    { data: estimates },
    { data: techs },
    { count: activeAgreements },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        'id, total, subtotal, payment_status, status, assigned_to, assigned_to_name, created_at, actual_hours, job_type, cost_total, gross_profit, margin_pct, customer_name'
      )
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .neq('status', 'Cancelled'),
    supabase
      .from('jobs')
      .select(
        'id, total, customer_name, invoice_sent_at, job_number, payment_status'
      )
      .eq('invoice_status', 'Sent')
      .neq('payment_status', 'Paid'),
    supabase
      .from('estimates')
      .select('id, status, total, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician'),
    supabase
      .from('service_agreements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active'),
  ]);

  let jobs = periodJobsRes.data ?? [];
  if (periodJobsRes.error) {
    const fallback = await supabase
      .from('jobs')
      .select(
        'id, total, subtotal, payment_status, status, assigned_to, assigned_to_name, created_at, actual_hours, job_type, customer_name'
      )
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .neq('status', 'Cancelled');
    jobs = (fallback.data ?? []).map((j) => ({
      ...j,
      cost_total: 0,
      gross_profit: 0,
      margin_pct: null,
    }));
  }
  const revenuePaid = jobs
    .filter((j) => j.payment_status === 'Paid')
    .reduce((s, j) => s + (Number(j.total) || 0), 0);
  const revenueOpen = jobs
    .filter((j) => j.payment_status !== 'Paid' && j.status === 'Completed')
    .reduce((s, j) => s + (Number(j.total) || 0), 0);
  const completedCount = jobs.filter((j) => j.status === 'Completed').length;
  const hoursLogged = jobs.reduce(
    (s, j) => s + (Number(j.actual_hours) || 0),
    0
  );

  const aging = {
    '0-30': { count: 0, total: 0 },
    '31-60': { count: 0, total: 0 },
    '61-90': { count: 0, total: 0 },
    '90+': { count: 0, total: 0 },
    current: { count: 0, total: 0 },
  };
  for (const j of unpaid ?? []) {
    const bucket = agingBucket(j.invoice_sent_at, now);
    const key = bucket === 'current' ? '0-30' : bucket;
    aging[key as keyof typeof aging].count += 1;
    aging[key as keyof typeof aging].total += Number(j.total) || 0;
  }
  const unpaidTotal = (unpaid ?? []).reduce(
    (s, j) => s + (Number(j.total) || 0),
    0
  );

  const estTotal = estimates ?? [];
  const closeRate =
    estTotal.length > 0
      ? Math.round(
          (estTotal.filter((e) => e.status === 'Approved').length /
            estTotal.length) *
            100
        )
      : 0;

  const byTech = (techs ?? [])
    .map((t) => {
      const techJobs = jobs.filter((j) => j.assigned_to === t.id);
      const paid = techJobs
        .filter((j) => j.payment_status === 'Paid')
        .reduce((s, j) => s + (Number(j.total) || 0), 0);
      const completed = techJobs.filter((j) => j.status === 'Completed').length;
      const hours = techJobs.reduce(
        (s, j) => s + (Number(j.actual_hours) || 0),
        0
      );
      const profit = techJobs.reduce(
        (s, j) => s + (Number(j.gross_profit) || 0),
        0
      );
      const cost = techJobs.reduce(
        (s, j) => s + (Number(j.cost_total) || 0),
        0
      );
      const sold = techJobs.reduce(
        (s, j) => s + (Number(j.subtotal) || Number(j.total) || 0),
        0
      );
      return {
        id: t.id,
        name: t.full_name || 'Tech',
        jobs: techJobs.length,
        completed,
        hours,
        paid,
        profit,
        cost,
        sold,
        margin: sold > 0 ? (profit / sold) * 100 : null,
        avg:
          techJobs.length > 0
            ? techJobs.reduce((s, j) => s + (Number(j.total) || 0), 0) /
              techJobs.length
            : 0,
      };
    })
    .sort((a, b) => (showCosting ? b.profit - a.profit : b.paid - a.paid));

  const avgTicket =
    jobs.length > 0
      ? jobs.reduce((s, j) => s + (Number(j.total) || 0), 0) / jobs.length
      : 0;

  const grossProfit = jobs.reduce(
    (s, j) => s + (Number(j.gross_profit) || 0),
    0
  );
  const totalCost = jobs.reduce((s, j) => s + (Number(j.cost_total) || 0), 0);
  const soldPreTax = jobs.reduce(
    (s, j) => s + (Number(j.subtotal) || Number(j.total) || 0),
    0
  );
  const avgMargin = soldPreTax > 0 ? (grossProfit / soldPreTax) * 100 : null;
  const belowTarget = jobs.filter((j) => {
    const m = j.margin_pct;
    return m != null && Number(m) < company.costing.target_margin_pct;
  });

  const byTypeMap = new Map<
    string,
    { jobs: number; sold: number; cost: number; profit: number }
  >();
  for (const j of jobs) {
    const key = (j.job_type || 'Untyped').trim() || 'Untyped';
    const row = byTypeMap.get(key) || {
      jobs: 0,
      sold: 0,
      cost: 0,
      profit: 0,
    };
    row.jobs += 1;
    row.sold += Number(j.subtotal) || Number(j.total) || 0;
    row.cost += Number(j.cost_total) || 0;
    row.profit += Number(j.gross_profit) || 0;
    byTypeMap.set(key, row);
  }
  const byType = [...byTypeMap.entries()]
    .map(([type, row]) => ({
      type,
      ...row,
      margin: row.sold > 0 ? (row.profit / row.sold) * 100 : null,
    }))
    .sort((a, b) => b.profit - a.profit);

  const worstJobs = [...jobs]
    .filter((j) => j.gross_profit != null)
    .sort((a, b) => (Number(a.gross_profit) || 0) - (Number(b.gross_profit) || 0))
    .slice(0, 10);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Reports
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {showCosting
              ? 'Profit, margins, revenue, tech productivity, and AR.'
              : 'Revenue, tech productivity, and AR aging for owners.'}
          </p>
          {showCosting && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <Link
                href="/dashboard/settings#job-costing"
                className="font-medium text-brand-700 hover:underline"
              >
                Costing settings
              </Link>
              <Link
                href="/dashboard/export"
                className="font-medium text-brand-700 hover:underline"
              >
                Export job costing CSV
              </Link>
            </p>
          )}
        </div>
        <ReportsDateFilter from={fromStr} to={toStr} />
      </div>

      {showAskAi && (
        <AskReports from={fromIso} to={toIso} />
      )}

      {showCosting && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Gross profit', value: formatMoney(grossProfit) },
            { label: 'Total job cost', value: formatMoney(totalCost) },
            {
              label: 'Avg margin',
              value: avgMargin == null ? '—' : `${avgMargin.toFixed(1)}%`,
            },
            {
              label: 'Below target margin',
              value: String(belowTarget.length),
            },
          ].map((c) => (
            <div key={c.label} className="panel border-brand-100 bg-brand-50/30 p-4">
              <p className="text-xs text-ink-500">{c.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Paid in period', value: formatMoney(revenuePaid) },
          { label: 'Completed unpaid', value: formatMoney(revenueOpen) },
          { label: 'AR outstanding', value: formatMoney(unpaidTotal) },
          { label: 'Avg ticket', value: formatMoney(avgTicket) },
        ].map((c) => (
          <div key={c.label} className="panel p-4">
            <p className="text-xs text-ink-500">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs text-ink-500">Jobs in period</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {jobs.length}
          </p>
          <p className="text-xs text-ink-400">{completedCount} completed</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-ink-500">Hours logged</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {hoursLogged.toFixed(1)}
          </p>
          <p className="text-xs text-ink-400">From clock-out actual hours</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-ink-500">Estimate close rate</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {closeRate}%
          </p>
          <p className="text-xs text-ink-400">
            {estTotal.length} estimates · {activeAgreements ?? 0} active plans
          </p>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="font-semibold">AR aging</h2>
          <p className="text-xs text-ink-400">
            Based on invoice sent date · unpaid only
          </p>
        </div>
        <div className="grid gap-px bg-ink-100 sm:grid-cols-4">
          {(
            [
              ['0-30', '0–30 days'],
              ['31-60', '31–60 days'],
              ['61-90', '61–90 days'],
              ['90+', '90+ days'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="bg-white p-4">
              <p className="text-xs text-ink-500">{label}</p>
              <p className="mt-1 font-display text-xl font-semibold">
                {formatMoney(aging[key].total)}
              </p>
              <p className="text-xs text-ink-400">
                {aging[key].count} invoice{aging[key].count === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="font-semibold">
            {showCosting ? 'Tech productivity & profit' : 'Tech productivity'}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-ink-50/80 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2 text-left">Tech</th>
              <th className="px-4 py-2 text-right">Jobs</th>
              <th className="hidden px-4 py-2 text-right sm:table-cell">
                Done
              </th>
              <th className="hidden px-4 py-2 text-right md:table-cell">
                Hours
              </th>
              {showCosting && (
                <th className="hidden px-4 py-2 text-right lg:table-cell">
                  Profit
                </th>
              )}
              {showCosting && (
                <th className="hidden px-4 py-2 text-right xl:table-cell">
                  Margin
                </th>
              )}
              <th className="px-4 py-2 text-right">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {byTech.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6">
                  <EmptyState
                    title="No technicians yet"
                    description="Add techs from signup invite codes, then assign jobs."
                  />
                </td>
              </tr>
            ) : (
              byTech.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-right">{t.jobs}</td>
                  <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                    {t.completed}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right md:table-cell">
                    {t.hours.toFixed(1)}
                  </td>
                  {showCosting && (
                    <td className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                      {formatMoney(t.profit)}
                    </td>
                  )}
                  {showCosting && (
                    <td className="hidden px-4 py-2.5 text-right xl:table-cell">
                      {t.margin == null ? '—' : `${t.margin.toFixed(1)}%`}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatMoney(t.paid)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showCosting && (
        <section className="panel overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="font-semibold">Profit by job type</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-ink-50/80 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Jobs</th>
                <th className="px-4 py-2 text-right">Sold</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">
                  Cost
                </th>
                <th className="px-4 py-2 text-right">Profit</th>
                <th className="hidden px-4 py-2 text-right md:table-cell">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {byType.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-ink-400"
                  >
                    No jobs in this period.
                  </td>
                </tr>
              ) : (
                byType.map((row) => (
                  <tr key={row.type}>
                    <td className="px-4 py-2.5 font-medium">{row.type}</td>
                    <td className="px-4 py-2.5 text-right">{row.jobs}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatMoney(row.sold)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                      {formatMoney(row.cost)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {formatMoney(row.profit)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right md:table-cell">
                      {row.margin == null ? '—' : `${row.margin.toFixed(1)}%`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {showCosting && worstJobs.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="font-semibold">Lowest profit jobs</h2>
          </div>
          <ul className="divide-y divide-ink-100">
            {worstJobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/dashboard/jobs/${j.id}`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-ink-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">
                      {j.customer_name || 'Customer'}
                    </span>
                    <span className="ml-2 text-xs text-ink-400">
                      {j.job_type || 'Job'}
                      {j.margin_pct != null
                        ? ` · ${Number(j.margin_pct).toFixed(0)}%`
                        : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-red-700">
                    {formatMoney(Number(j.gross_profit) || 0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h2 className="font-semibold">Unpaid invoices</h2>
          <Link
            href="/dashboard/invoices?filter=unpaid"
            className="text-sm text-brand-700 hover:underline"
          >
            Invoices
          </Link>
        </div>
        <ul className="divide-y divide-ink-100">
          {(unpaid ?? []).slice(0, 20).map((j) => {
            const bucket = agingBucket(j.invoice_sent_at, now);
            const ageLabel =
              bucket === 'current' || bucket === '0-30'
                ? '0–30d'
                : bucket === '31-60'
                  ? '31–60d'
                  : bucket === '61-90'
                    ? '61–90d'
                    : '90d+';
            return (
              <li key={j.id}>
                <Link
                  href={`/dashboard/jobs/${j.id}`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-ink-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">
                      {j.customer_name || 'Customer'}
                    </span>
                    <span className="ml-2 text-xs text-ink-400">{ageLabel}</span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(Number(j.total) || 0)}
                  </span>
                </Link>
              </li>
            );
          })}
          {(unpaid ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-ink-400">
              All clear — nothing unpaid.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
