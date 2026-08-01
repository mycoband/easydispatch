import Link from 'next/link';
import { formatTimestamp } from '@/lib/jobs/time-tracking';
import { formatMoney } from '@/lib/jobs/totals';

export type HistoryJob = {
  id: string;
  job_number: string | null;
  job_type: string | null;
  status: string | null;
  diagnosis: string | null;
  scheduled_start: string | null;
  created_at: string;
  total: number | null;
  equipment_id: string | null;
  is_callback?: boolean | null;
};

export function EquipmentHistory({
  jobs,
  equipment,
}: {
  jobs: HistoryJob[];
  equipment: { id: string; name: string | null; equipment_type: string | null }[];
}) {
  const nameById = new Map(
    equipment.map((e) => [e.id, e.name || e.equipment_type || 'Unit'])
  );

  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-semibold text-ink-950">
        Service history
      </h2>
      <p className="mt-0.5 text-sm text-ink-500">
        Past jobs at this property — diagnoses, equipment, totals
      </p>

      {jobs.length === 0 ? (
        <p className="mt-4 text-sm text-ink-400">No jobs yet for this customer.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {job.job_number || job.id.slice(0, 8)} ·{' '}
                    {job.job_type || 'Job'}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {formatTimestamp(job.scheduled_start || job.created_at)} ·{' '}
                    {job.status}
                    {job.equipment_id
                      ? ` · ${nameById.get(job.equipment_id) || 'Equipment'}`
                      : ''}
                    {job.is_callback ? ' · Callback' : ''}
                  </p>
                </div>
                <span className="font-medium">
                  {formatMoney(Number(job.total) || 0)}
                </span>
              </div>
              {job.diagnosis && (
                <p className="mt-1.5 line-clamp-2 text-ink-700">
                  {job.diagnosis}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
