'use client';

import { useEffect, useState } from 'react';
import { PmChecklistPanel } from '@/components/equipment/PmChecklistPanel';

type Unit = {
  id: string;
  name: string | null;
  equipment_type: string | null;
  manufacturer?: string | null;
  model?: string | null;
  pm_checklist?: unknown;
};

/**
 * PM checklist on a job — editable items + per-item photos (also → Job photos).
 */
export function JobPmChecklist({
  customerId,
  jobId,
  equipmentId,
  equipment,
  units = [],
}: {
  customerId: string;
  jobId?: string | null;
  equipmentId: string | null;
  equipment?: Unit | null;
  units?: Unit[];
}) {
  const linked =
    equipment ||
    (equipmentId ? units.find((u) => u.id === equipmentId) : null) ||
    null;

  const [activeId, setActiveId] = useState<string | null>(
    linked?.id || units[0]?.id || null
  );

  useEffect(() => {
    const preferred = linked?.id || units[0]?.id || null;
    if (!preferred) return;
    if (!activeId || !units.some((u) => u.id === activeId)) {
      setActiveId(preferred);
    }
  }, [linked?.id, units, activeId]);

  const active =
    (activeId && units.find((u) => u.id === activeId)) || linked || null;

  if (!customerId) return null;

  if (!active) {
    return (
      <section className="panel space-y-2 border-amber-200 bg-amber-50/40 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          PM checklist
        </h2>
        <p className="text-sm text-ink-600">
          Link a unit under Equipment on this job to fill out the maintenance
          checklist for that equipment.
        </p>
      </section>
    );
  }

  const unitLabel = [
    active.name || active.equipment_type || 'Unit',
    [active.manufacturer, active.model].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          PM checklist
        </h2>
        {units.length > 1 && (
          <select
            value={active.id}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.equipment_type || 'Unit'}
                {u.id === equipmentId ? ' (on job)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {!equipmentId && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tip: link this unit on the job (Equipment → Use on job) so the
          checklist stays tied to the visit. Photos still file to this job when
          you upload from here.
        </p>
      )}

      <PmChecklistPanel
        customerId={customerId}
        equipmentId={active.id}
        jobId={jobId}
        rawChecklist={active.pm_checklist}
        unitLabel={unitLabel}
        compact
      />
    </section>
  );
}
