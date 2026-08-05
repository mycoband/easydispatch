import Link from 'next/link';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { OfficePaymentAlerts } from '@/components/invoices/OfficePaymentAlerts';
import { requireOffice } from '@/lib/auth';
import { localDateKey } from '@/lib/calendar/week';
import { loadCompanySettings } from '@/lib/company';
import { COMPANY_MODULES, type ModuleId } from '@/lib/company/modules';
import { deriveLiveStatus, formatTimestamp } from '@/lib/jobs/time-tracking';
import { formatMoney } from '@/lib/jobs/totals';

export default async function OfficeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ moduleDisabled?: string }>;
}) {
  const { profile, supabase } = await requireOffice();
  const company = await loadCompanySettings();
  const mods = company.modules;
  const { moduleDisabled } = await searchParams;
  const disabledMeta = COMPANY_MODULES.find(
    (m) => m.id === (moduleDisabled as ModuleId)
  );

  const todayKey = localDateKey(new Date());
  const dayStart = new Date(`${todayKey}T00:00:00`);
  const dayEnd = new Date(`${todayKey}T23:59:59.999`);

  const [
    { count: customerCount },
    { count: jobCount },
    { count: unassignedCount },
    { count: unpaidCount },
    { data: paymentAlerts },
    { data: todayJobs },
    { count: enRouteCount },
    { count: onSiteCount },
    { data: unassignedJobs },
    { data: unpaidJobs },
    { data: callbackJobs },
    { data: intakeJobs },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .is('assigned_to', null)
      .neq('status', 'Cancelled')
      .neq('status', 'Completed'),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'Unpaid')
      .eq('invoice_status', 'Sent'),
    supabase
      .from('messages')
      .select('id, job_id, body, created_at')
      .eq('to_address', 'office')
      .eq('status', 'payment:paid')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, job_type, status, assigned_to_name, scheduled_start, drive_started_at, check_in_at, check_out_at, assigned_to, priority'
      )
      .neq('status', 'Cancelled')
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(20),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .not('drive_started_at', 'is', null)
      .is('check_in_at', null)
      .neq('status', 'Completed')
      .neq('status', 'Cancelled'),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .not('check_in_at', 'is', null)
      .is('check_out_at', null)
      .neq('status', 'Completed')
      .neq('status', 'Cancelled'),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, job_type, priority, scheduled_start'
      )
      .is('assigned_to', null)
      .neq('status', 'Cancelled')
      .neq('status', 'Completed')
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, total, invoice_sent_at, payment_status'
      )
      .eq('payment_status', 'Unpaid')
      .eq('invoice_status', 'Sent')
      .order('invoice_sent_at', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, job_type, scheduled_start, assigned_to_name'
      )
      .eq('is_callback', true)
      .neq('status', 'Cancelled')
      .neq('status', 'Completed')
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .limit(5),
    mods.ai_receptionist
      ? supabase
          .from('jobs')
          .select(
            'id, job_number, customer_name, job_type, intake_source, intake_summary, created_at'
          )
          .not('intake_source', 'is', null)
          .is('scheduled_start', null)
          .neq('status', 'Cancelled')
          .neq('status', 'Completed')
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as {
          id: string;
          job_number: string | null;
          customer_name: string | null;
          job_type: string | null;
          intake_source: string | null;
          intake_summary: string | null;
          created_at: string;
        }[] }),
  ]);

  const needsYouRows: {
    id: string;
    label: string;
    detail: string;
    href: string;
    tone: 'amber' | 'rose' | 'sky' | 'violet';
  }[] = [];

  if (mods.dispatch) {
    for (const job of unassignedJobs ?? []) {
      needsYouRows.push({
        id: `unassigned-${job.id}`,
        label: 'Unassigned',
        detail: `${job.customer_name || 'Customer'} · ${job.job_type || 'Job'}${
          job.scheduled_start
            ? ` · ${formatTimestamp(job.scheduled_start)}`
            : ''
        }`,
        href: `/dashboard/jobs/${job.id}`,
        tone: 'amber',
      });
    }
  }

  if (mods.invoices) {
    for (const job of unpaidJobs ?? []) {
      needsYouRows.push({
        id: `unpaid-${job.id}`,
        label: 'Unpaid invoice',
        detail: `${job.customer_name || 'Customer'} · ${formatMoney(
          Number(job.total) || 0
        )}`,
        href: `/dashboard/jobs/${job.id}`,
        tone: 'rose',
      });
    }
  }

  for (const job of callbackJobs ?? []) {
    needsYouRows.push({
      id: `callback-${job.id}`,
      label: 'Callback',
      detail: `${job.customer_name || 'Customer'} · ${
        job.assigned_to_name || 'Unassigned'
      }${
        job.scheduled_start ? ` · ${formatTimestamp(job.scheduled_start)}` : ''
      }`,
      href: `/dashboard/jobs/${job.id}`,
      tone: 'sky',
    });
  }

  if (mods.ai_receptionist) {
    for (const job of intakeJobs ?? []) {
      const via =
        job.intake_source === 'ai_voice'
          ? 'phone'
          : job.intake_source === 'ai_sms'
            ? 'SMS'
            : 'intake';
      needsYouRows.unshift({
        id: `intake-${job.id}`,
        label: 'Unscheduled intake',
        detail: `${job.customer_name || 'Caller'} · ${via}${
          job.intake_summary ? ` · ${job.intake_summary}` : ''
        }`,
        href: `/dashboard/jobs/${job.id}`,
        tone: 'violet',
      });
    }
  }

  const cards = [
    { label: 'Today', value: todayJobs?.length ?? 0, href: '/dashboard/calendar' },
    { label: 'Unassigned', value: unassignedCount ?? 0, href: '/dashboard/dispatch' },
    { label: 'En route', value: enRouteCount ?? 0, href: '/dashboard/dispatch' },
    { label: 'On site', value: onSiteCount ?? 0, href: '/dashboard/dispatch' },
    { label: 'Unpaid', value: unpaidCount ?? 0, href: '/dashboard/invoices?filter=unpaid' },
    { label: 'Customers', value: customerCount ?? 0, href: '/dashboard/customers' },
  ];

  const toneClass = {
    amber: 'bg-amber-100 text-amber-900',
    rose: 'bg-rose-100 text-rose-900',
    sky: 'bg-sky-100 text-sky-900',
    violet: 'bg-violet-100 text-violet-900',
  } as const;

  return (
    <div className="space-y-6">
      {disabledMeta && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">{disabledMeta.label}</span> is turned
          off for this company.{' '}
          <Link
            href="/dashboard/settings"
            className="font-semibold text-brand-700 underline"
          >
            Enable it in Settings → Feature modules
          </Link>
          .
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Office dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Welcome{profile.full_name ? `, ${profile.full_name}` : ''}. Start
            with what needs you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/estimates/new"
            className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            New estimate
          </Link>
          <Link
            href="/dashboard/jobs/new"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New job
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Needs you
            </h2>
            <p className="text-sm text-ink-500">
              Unassigned jobs, unpaid invoices, open callbacks
            </p>
          </div>
          {mods.dispatch && (
            <Link
              href="/dashboard/dispatch"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              Open dispatch
            </Link>
          )}
        </div>
        {needsYouRows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-500">
            You&apos;re clear — nothing urgent right now.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {needsYouRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-ink-50/70"
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass[row.tone]}`}
                    >
                      {row.label}
                    </span>
                    <p className="mt-1 text-sm font-medium text-ink-900">
                      {row.detail}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brand-700">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(unassignedCount || unpaidCount) && needsYouRows.length > 0 ? (
          <div className="flex flex-wrap gap-3 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
            {mods.dispatch && (unassignedCount ?? 0) > 0 && (
              <Link href="/dashboard/dispatch" className="hover:text-brand-700">
                {unassignedCount} unassigned total
              </Link>
            )}
            {mods.invoices && (unpaidCount ?? 0) > 0 && (
              <Link
                href="/dashboard/invoices?filter=unpaid"
                className="hover:text-brand-700"
              >
                {unpaidCount} unpaid total
              </Link>
            )}
          </div>
        ) : null}
      </section>

      <OfficePaymentAlerts alerts={paymentAlerts ?? []} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="panel p-4 transition hover:border-brand-300"
          >
            <p className="text-xs text-ink-500">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink-950">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <section className="panel p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">
              Today&apos;s schedule
            </h2>
            <p className="text-sm text-ink-500">
              {todayJobs?.length ?? 0} job
              {(todayJobs?.length ?? 0) === 1 ? '' : 's'} · {jobCount ?? 0}{' '}
              total in system
            </p>
          </div>
          <Link
            href="/dashboard/calendar"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Open calendar
          </Link>
        </div>

        {(todayJobs ?? []).length === 0 ? (
          <p className="py-6 text-sm text-ink-400">
            Nothing scheduled today.{' '}
            <Link
              href={`/dashboard/jobs/new?date=${todayKey}`}
              className="font-medium text-brand-700 hover:underline"
            >
              Schedule a job
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {(todayJobs ?? []).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-ink-50/60"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {job.customer_name || 'Customer'}
                    </p>
                    <p className="text-sm text-ink-500">
                      {formatTimestamp(job.scheduled_start)} ·{' '}
                      {job.job_type || 'Job'} ·{' '}
                      {job.assigned_to_name || 'Unassigned'}
                    </p>
                  </div>
                  <LiveStatusBadge status={deriveLiveStatus(job)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
