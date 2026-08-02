import Link from 'next/link';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { requireTechApp } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { deriveLiveStatus, formatTimestamp } from '@/lib/jobs/time-tracking';
import {
  nextActionHint,
  nextUpCtaLabel,
  phaseFromLiveStatus,
} from '@/lib/tech/job-phases';

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isSameLocalDay(iso: string | null | undefined, day: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= startOfLocalDay(day).getTime() && t <= endOfLocalDay(day).getTime();
}

type JobRow = {
  id: string;
  job_number: string | null;
  customer_name: string | null;
  status: string | null;
  scheduled_start: string | null;
  priority: string | null;
  drive_started_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  internal_notes: string | null;
  assigned_to_name?: string | null;
};

function JobCard({
  job,
  showAssignee,
  quiet,
}: {
  job: JobRow;
  showAssignee?: boolean;
  quiet?: boolean;
}) {
  const live = deriveLiveStatus(job);
  const phase = phaseFromLiveStatus(live);
  const hint = nextActionHint(live);

  return (
    <Link
      href={`/tech/jobs/${job.id}?phase=${phase}`}
      className={
        quiet
          ? 'block rounded-xl border border-ink-100 bg-white px-4 py-3 transition hover:border-brand-300'
          : 'panel block p-4 transition hover:border-brand-300 active:bg-ink-50/40 sm:p-5'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              quiet
                ? 'font-medium text-ink-900'
                : 'text-base font-semibold text-ink-900 sm:text-lg'
            }
          >
            {job.customer_name || 'Customer'}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {job.job_number || job.id.slice(0, 8)}
            {job.priority ? ` · ${job.priority}` : ''}
            {job.scheduled_start
              ? ` · ${formatTimestamp(job.scheduled_start)}`
              : ''}
            {showAssignee
              ? ` · ${job.assigned_to_name || 'Unassigned'}`
              : ''}
          </p>
          {!quiet && (
            <p className="mt-2 text-sm font-semibold text-brand-800">
              Next: {hint}
            </p>
          )}
          {job.internal_notes && !quiet && (
            <p className="mt-2 line-clamp-2 text-sm text-amber-900">
              {job.internal_notes}
            </p>
          )}
        </div>
        <LiveStatusBadge status={live} />
      </div>
    </Link>
  );
}

function JobGroup({
  title,
  jobs,
  empty,
  showAssignee,
  quiet,
}: {
  title: string;
  jobs: JobRow[];
  empty?: string;
  showAssignee?: boolean;
  quiet?: boolean;
}) {
  if (jobs.length === 0) {
    if (!empty) return null;
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {title}
        </h2>
        <p className="text-sm text-ink-500">{empty}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {title}
        <span className="ml-2 font-medium normal-case text-ink-300">
          ({jobs.length})
        </span>
      </h2>
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            showAssignee={showAssignee}
            quiet={quiet}
          />
        ))}
      </div>
    </section>
  );
}

export default async function TechHomePage() {
  const { profile, supabase, user, techViewPreview } = await requireTechApp();
  const company = await loadCompanySettings();
  const allowPdf = Boolean(company.modules.print_pdfs);

  let query = supabase
    .from('jobs')
    .select(
      'id, job_number, customer_name, status, scheduled_start, priority, drive_started_at, check_in_at, check_out_at, internal_notes, assigned_to_name'
    )
    .neq('status', 'Cancelled')
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .limit(techViewPreview ? 50 : 30);

  if (!techViewPreview) {
    query = query.eq('assigned_to', user.id);
  }

  const { data: jobs } = await query;

  const list = (jobs ?? []) as JobRow[];
  const today = new Date();

  const inProgress = list.filter((j) => {
    const live = deriveLiveStatus(j);
    return live === 'En Route' || live === 'On Site';
  });

  const todayJobs = list.filter((j) => {
    if (inProgress.some((x) => x.id === j.id)) return false;
    if (deriveLiveStatus(j) === 'Completed') return false;
    return isSameLocalDay(j.scheduled_start, today) || !j.scheduled_start;
  });

  const laterJobs = list.filter((j) => {
    if (inProgress.some((x) => x.id === j.id)) return false;
    if (todayJobs.some((x) => x.id === j.id)) return false;
    if (deriveLiveStatus(j) === 'Completed') return false;
    if (!j.scheduled_start) return false;
    return new Date(j.scheduled_start).getTime() > endOfLocalDay(today).getTime();
  });

  const doneToday = list.filter(
    (j) =>
      deriveLiveStatus(j) === 'Completed' &&
      (isSameLocalDay(j.check_out_at, today) ||
        isSameLocalDay(j.scheduled_start, today))
  );

  const groupedIds = new Set(
    [...inProgress, ...todayJobs, ...laterJobs, ...doneToday].map((j) => j.id)
  );
  const otherJobs = list.filter((j) => !groupedIds.has(j.id));

  const nextUp = inProgress[0] || todayJobs[0] || null;
  const nextLive = nextUp ? deriveLiveStatus(nextUp) : null;
  const nextPhase = nextLive ? phaseFromLiveStatus(nextLive) : 'arrive';
  const stopsLeftToday =
    inProgress.length +
    todayJobs.filter((j) => deriveLiveStatus(j) !== 'Completed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            {techViewPreview ? 'Shop jobs (tech view)' : 'My jobs'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Hi{profile.full_name ? ` ${profile.full_name}` : ''}.{' '}
            {techViewPreview
              ? 'Browsing the technician ticket UI for your company.'
              : 'Your next stop is up top.'}
          </p>
        </div>
        {allowPdf && (
          <a
            href="/api/tech/run-sheet/pdf"
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Today&apos;s run sheet PDF
          </a>
        )}
      </div>

      {list.length === 0 ? (
        <div className="panel p-6">
          <p className="text-sm text-ink-600">
            {techViewPreview
              ? 'No open jobs for this company yet.'
              : 'No jobs assigned yet. Once office assigns you, they’ll show up here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {nextUp && nextLive && (
            <section className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-b from-brand-50 to-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
                Next up
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold text-ink-950 sm:text-2xl">
                    {nextUp.customer_name || 'Customer'}
                  </h2>
                  <p className="mt-1 text-sm text-ink-600">
                    {nextUp.job_number || nextUp.id.slice(0, 8)}
                    {nextUp.scheduled_start
                      ? ` · ${formatTimestamp(nextUp.scheduled_start)}`
                      : ''}
                    {techViewPreview
                      ? ` · ${nextUp.assigned_to_name || 'Unassigned'}`
                      : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand-900">
                    {nextActionHint(nextLive)}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {stopsLeftToday} stop{stopsLeftToday === 1 ? '' : 's'} left
                    today
                  </p>
                </div>
                <LiveStatusBadge status={nextLive} />
              </div>
              <Link
                href={`/tech/jobs/${nextUp.id}?phase=${nextPhase}`}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-4 text-base font-semibold text-white hover:bg-brand-700"
              >
                {nextUpCtaLabel(nextLive)}
              </Link>
            </section>
          )}

          <div className="space-y-6 opacity-95">
            <JobGroup
              title="In progress"
              jobs={inProgress.filter((j) => j.id !== nextUp?.id)}
              showAssignee={techViewPreview}
              quiet
            />
            <JobGroup
              title="Today"
              jobs={todayJobs.filter((j) => j.id !== nextUp?.id)}
              showAssignee={techViewPreview}
              quiet
              empty={
                !nextUp && inProgress.length === 0
                  ? 'Nothing scheduled for today.'
                  : undefined
              }
            />
            <JobGroup
              title="Later"
              jobs={laterJobs}
              showAssignee={techViewPreview}
              quiet
            />
            <JobGroup
              title="Done today"
              jobs={doneToday}
              showAssignee={techViewPreview}
              quiet
            />
            <JobGroup
              title="Other"
              jobs={otherJobs}
              showAssignee={techViewPreview}
              quiet
            />
          </div>
        </div>
      )}
    </div>
  );
}
