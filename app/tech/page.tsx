import Link from 'next/link';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { requireTech } from '@/lib/auth';
import { deriveLiveStatus, formatTimestamp } from '@/lib/jobs/time-tracking';

export default async function TechHomePage() {
  const { profile, supabase, user } = await requireTech();

  const { data: jobs } = await supabase
    .from('jobs')
    .select(
      'id, job_number, customer_name, status, scheduled_start, priority, drive_started_at, check_in_at, check_out_at, internal_notes'
    )
    .eq('assigned_to', user.id)
    .neq('status', 'Cancelled')
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          My jobs
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Hi{profile.full_name ? ` ${profile.full_name}` : ''}. Open a job for
          the full run sheet — packet, drive, diagnose, parts, sign & pay.
        </p>
      </div>

      <div className="space-y-3">
        {(jobs ?? []).length === 0 ? (
          <div className="panel p-6">
            <p className="text-sm text-ink-600">
              No jobs assigned yet. Once office assigns you, they&apos;ll show
              up here.
            </p>
          </div>
        ) : (
          (jobs ?? []).map((job) => {
            const live = deriveLiveStatus(job);
            return (
              <Link
                key={job.id}
                href={`/tech/jobs/${job.id}`}
                className="panel block p-4 transition hover:border-brand-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {job.customer_name || 'Customer'}
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      {job.job_number || job.id.slice(0, 8)}
                      {job.priority ? ` · ${job.priority}` : ''}
                      {job.scheduled_start
                        ? ` · ${formatTimestamp(job.scheduled_start)}`
                        : ''}
                    </p>
                    {job.internal_notes && (
                      <p className="mt-2 line-clamp-2 text-sm text-amber-900">
                        {job.internal_notes}
                      </p>
                    )}
                  </div>
                  <LiveStatusBadge status={live} />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
