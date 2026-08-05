import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { formatTimestamp } from '@/lib/jobs/time-tracking';

export default async function IntakeLogPage() {
  const { supabase } = await requireOffice();
  const company = await loadCompanySettings();

  if (!company.modules.ai_receptionist) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          AI receptionist
        </h1>
        <p className="text-sm text-ink-600">
          Turn on Feature modules → AI receptionist (and AI tools) to log
          inbound SMS and phone intake here.
        </p>
        <Link
          href="/dashboard/settings#settings-modules"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          Open Feature modules
        </Link>
      </div>
    );
  }

  const [{ data: events }, { data: openJobs }] = await Promise.all([
    supabase
      .from('intake_events')
      .select('id, channel, from_phone, event_type, job_id, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, intake_source, intake_summary, created_at'
      )
      .not('intake_source', 'is', null)
      .is('scheduled_start', null)
      .neq('status', 'Cancelled')
      .neq('status', 'Completed')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          AI receptionist
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Inbound SMS and phone calls create undated jobs. Schedule them on
          Calendar or Dispatch.
        </p>
      </div>

      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Needs scheduling
        </h2>
        {(openJobs ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No open intake jobs.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {(openJobs ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {job.customer_name || 'Caller'}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {job.intake_source === 'ai_voice' ? 'Phone' : 'SMS'}
                    {job.intake_summary ? ` · ${job.intake_summary}` : ''}
                  </p>
                </div>
                <span className="text-xs text-ink-400">
                  {formatTimestamp(job.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Recent intake log
        </h2>
        {(events ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No events yet. Point Twilio SMS and Vapi voice webhooks at this
            shop, then send a test message.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex flex-wrap justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-ink-900">
                    {ev.event_type}
                  </span>
                  <span className="text-ink-500">
                    {' '}
                    · {ev.channel}
                    {ev.from_phone ? ` · ${ev.from_phone}` : ''}
                  </span>
                  {ev.job_id ? (
                    <>
                      {' '}
                      ·{' '}
                      <Link
                        href={`/dashboard/jobs/${ev.job_id}`}
                        className="text-brand-700 hover:underline"
                      >
                        Open job
                      </Link>
                    </>
                  ) : null}
                </div>
                <span className="text-xs text-ink-400">
                  {formatTimestamp(ev.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
