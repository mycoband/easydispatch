import Link from 'next/link';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { requireOffice } from '@/lib/auth';
import { localDateKey } from '@/lib/calendar/week';
import { deriveLiveStatus, formatTimestamp } from '@/lib/jobs/time-tracking';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function DaySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireCompanyModule('day_sheet');

  const { supabase } = await requireOffice();
  const { date } = await searchParams;
  const dayKey =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateKey(new Date());
  const dayStart = new Date(`${dayKey}T00:00:00`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999`);

  const [{ data: techs }, { data: jobs }, { data: unscheduled }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .order('full_name'),
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_name, job_type, status, priority, assigned_to, assigned_to_name, scheduled_start, est_hours, drive_started_at, check_in_at, check_out_at, internal_notes, is_callback, warranty_flag'
        )
        .neq('status', 'Cancelled')
        .gte('scheduled_start', dayStart.toISOString())
        .lte('scheduled_start', dayEnd.toISOString())
        .order('scheduled_start', { ascending: true }),
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_name, job_type, status, priority, assigned_to_name'
        )
        .neq('status', 'Cancelled')
        .neq('status', 'Completed')
        .is('scheduled_start', null)
        .limit(20),
    ]);

  const byTech = new Map<string | 'unassigned', typeof jobs>();
  byTech.set('unassigned', []);
  for (const t of techs ?? []) byTech.set(t.id, []);

  for (const job of jobs ?? []) {
    const key = job.assigned_to || 'unassigned';
    if (!byTech.has(key)) byTech.set(key, []);
    byTech.get(key)!.push(job);
  }

  const prev = new Date(dayStart);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(dayStart);
  next.setDate(next.getDate() + 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Day sheet
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Tech load for{' '}
            {dayStart.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/day-sheet?date=${localDateKey(prev)}`}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            ← Prev
          </Link>
          <Link
            href="/dashboard/day-sheet"
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            Today
          </Link>
          <Link
            href={`/dashboard/day-sheet?date=${localDateKey(next)}`}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            Next →
          </Link>
          <Link
            href={`/dashboard/jobs/new?date=${dayKey}`}
            className="rounded-xl bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white"
          >
            + Add stop
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TechColumn
          title="Unassigned"
          subtitle="Drop onto a tech from Dispatch"
          jobs={byTech.get('unassigned') || []}
          hoursLabel
        />
        {(techs ?? []).map((tech) => {
          const list = byTech.get(tech.id) || [];
          const hours = list.reduce(
            (sum, j) => sum + (Number(j.est_hours) || 1.5),
            0
          );
          const active = list.filter(
            (j) => j.status !== 'Completed'
          ).length;
          return (
            <TechColumn
              key={tech.id}
              title={tech.full_name || 'Tech'}
              subtitle={`${active} active · ~${hours.toFixed(1)}h est`}
              jobs={list}
              overloaded={hours > 8}
            />
          );
        })}
      </div>

      {(unscheduled ?? []).length > 0 && (
        <section className="panel p-4">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Unscheduled backlog
          </h2>
          <p className="mb-3 text-xs text-ink-500">
            Add a time on the job or schedule from Calendar
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(unscheduled ?? []).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="block rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2 text-sm hover:border-brand-300"
                >
                  <p className="font-medium">{job.customer_name || 'Customer'}</p>
                  <p className="text-xs text-ink-500">
                    {job.job_type || 'Job'} · {job.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TechColumn({
  title,
  subtitle,
  jobs,
  overloaded,
}: {
  title: string;
  subtitle: string;
  jobs: {
    id: string;
    job_number: string | null;
    customer_name: string | null;
    job_type: string | null;
    priority: string | null;
    scheduled_start: string | null;
    est_hours: number | null;
    drive_started_at: string | null;
    check_in_at: string | null;
    check_out_at: string | null;
    status: string | null;
    internal_notes: string | null;
    is_callback?: boolean | null;
    warranty_flag?: boolean | null;
    assigned_to?: string | null;
  }[];
  hoursLabel?: boolean;
  overloaded?: boolean;
}) {
  return (
    <section
      className={`panel flex min-h-[280px] flex-col p-4 ${
        overloaded ? 'border-amber-300 bg-amber-50/30' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">{title}</p>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs">
          {jobs.length}
        </span>
      </div>
      <div className="flex-1 space-y-2">
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-300">No jobs</p>
        ) : (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/dashboard/jobs/${job.id}`}
              className="block rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm hover:border-brand-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {job.customer_name || 'Customer'}
                  </p>
                  <p className="text-xs text-ink-500">
                    {job.scheduled_start
                      ? formatTimestamp(job.scheduled_start)
                      : 'No time'}{' '}
                    · {job.job_type || 'Job'}
                    {job.est_hours != null ? ` · ${job.est_hours}h` : ''}
                  </p>
                  {(job.is_callback || job.warranty_flag) && (
                    <p className="mt-0.5 text-[10px] font-semibold text-amber-800">
                      {job.is_callback ? 'Callback' : ''}
                      {job.is_callback && job.warranty_flag ? ' · ' : ''}
                      {job.warranty_flag ? 'Warranty' : ''}
                    </p>
                  )}
                  {job.internal_notes && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-amber-900">
                      {job.internal_notes}
                    </p>
                  )}
                </div>
                <LiveStatusBadge status={deriveLiveStatus(job)} />
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
