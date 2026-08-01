'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveEquipmentPmChecklist } from '@/app/dashboard/customers/actions';
import {
  EQUIPMENT_PM_ITEMS,
  normalizePmChecklist,
  type PmChecklistState,
} from '@/lib/equipment/pm-checklist';
import { formatTimestamp } from '@/lib/jobs/time-tracking';
import { formatMoney } from '@/lib/jobs/totals';
import { cn } from '@/lib/utils';

type Unit = {
  id: string;
  name: string | null;
  equipment_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  pm_checklist?: unknown;
};

type JobRow = {
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

export function EquipmentTimeline({
  customerId,
  equipment,
  jobs,
}: {
  customerId: string;
  equipment: Unit[];
  jobs: JobRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(
    equipment[0]?.id || null
  );

  if (equipment.length === 0) {
    return (
      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Equipment timeline
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Add units above to track per-unit history and PM checklists.
        </p>
      </section>
    );
  }

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Equipment timeline
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Full history and PM checklist per unit — builds trust on callbacks
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {equipment.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setOpenId(u.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold',
              openId === u.id
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50'
            )}
          >
            {u.name || u.equipment_type || 'Unit'}
          </button>
        ))}
      </div>
      {equipment.map((u) =>
        openId === u.id ? (
          <UnitPanel
            key={u.id}
            customerId={customerId}
            unit={u}
            jobs={jobs.filter((j) => j.equipment_id === u.id)}
          />
        ) : null
      )}
    </section>
  );
}

function UnitPanel({
  customerId,
  unit,
  jobs,
}: {
  customerId: string;
  unit: Unit;
  jobs: JobRow[];
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<PmChecklistState>(() =>
    normalizePmChecklist(unit.pm_checklist)
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(id: string) {
    const next: PmChecklistState = {
      ...checklist,
      [id]: {
        checked: !checklist[id as keyof PmChecklistState]?.checked,
        at: new Date().toISOString(),
      },
    };
    setChecklist(next);
    setPending(true);
    setMsg(null);
    const result = await saveEquipmentPmChecklist(
      customerId,
      unit.id,
      next
    );
    setMsg(result.error || result.success || null);
    setPending(false);
    if (!result.error) router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-ink-100 bg-ink-50/40 p-4">
      <div>
        <p className="font-semibold text-ink-900">
          {unit.name || unit.equipment_type || 'Unit'}
        </p>
        <p className="text-xs text-ink-500">
          {[unit.manufacturer, unit.model, unit.serial_number]
            .filter(Boolean)
            .join(' · ') || 'No plate details'}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          PM checklist {pending ? '· saving…' : ''}
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {EQUIPMENT_PM_ITEMS.map((item) => {
            const checked = Boolean(checklist[item.id]?.checked);
            return (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-100 bg-white px-2.5 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => void toggle(item.id)}
                    className="mt-0.5"
                  />
                  <span className={checked ? 'text-ink-500 line-through' : ''}>
                    {item.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {msg && <p className="mt-2 text-xs text-ink-600">{msg}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Service history ({jobs.length})
        </p>
        {jobs.length === 0 ? (
          <p className="text-sm text-ink-400">
            No jobs linked to this unit yet — link equipment on a job to build
            the timeline.
          </p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {job.job_number || job.id.slice(0, 8)} ·{' '}
                    {job.job_type || 'Job'}
                  </Link>
                  <span>{formatMoney(Number(job.total) || 0)}</span>
                </div>
                <p className="text-xs text-ink-500">
                  {formatTimestamp(job.scheduled_start || job.created_at)} ·{' '}
                  {job.status}
                  {job.is_callback ? ' · Callback' : ''}
                </p>
                {job.diagnosis && (
                  <p className="mt-1 line-clamp-2 text-ink-700">
                    {job.diagnosis}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
