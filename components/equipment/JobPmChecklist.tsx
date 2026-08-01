'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveEquipmentPmChecklist } from '@/app/dashboard/customers/actions';
import {
  EQUIPMENT_PM_ITEMS,
  normalizePmChecklist,
  type PmChecklistState,
} from '@/lib/equipment/pm-checklist';
import { cn } from '@/lib/utils';

type Unit = {
  id: string;
  name: string | null;
  equipment_type: string | null;
  manufacturer?: string | null;
  model?: string | null;
  pm_checklist?: unknown;
};

/**
 * PM checklist on a job — fills when a unit is linked to the job.
 * Saved on the equipment record (same list as customer Equipment timeline).
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
  /** Linked unit (preferred) */
  equipment?: Unit | null;
  /** All customer units — picker if none linked */
  units?: Unit[];
}) {
  const router = useRouter();
  const linked =
    equipment ||
    (equipmentId ? units.find((u) => u.id === equipmentId) : null) ||
    null;

  const [activeId, setActiveId] = useState<string | null>(
    linked?.id || units[0]?.id || null
  );
  const active =
    (activeId && units.find((u) => u.id === activeId)) || linked || null;

  const [checklist, setChecklist] = useState<PmChecklistState>(() =>
    normalizePmChecklist(active?.pm_checklist)
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setChecklist(normalizePmChecklist(active?.pm_checklist));
  }, [active?.id, active?.pm_checklist]);

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

  async function toggle(id: string) {
    if (!active) return;
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
      active.id,
      next,
      jobId
    );
    setMsg(result.error || result.success || null);
    setPending(false);
    if (!result.error) router.refresh();
  }

  const done = EQUIPMENT_PM_ITEMS.filter((i) =>
    Boolean(checklist[i.id]?.checked)
  ).length;

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            PM checklist
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {active.name || active.equipment_type || 'Unit'}
            {active.manufacturer || active.model
              ? ` · ${[active.manufacturer, active.model].filter(Boolean).join(' ')}`
              : ''}
            {' · '}
            {done}/{EQUIPMENT_PM_ITEMS.length} done
            {pending ? ' · saving…' : ''}
          </p>
        </div>
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
          checklist stays tied to the visit.
        </p>
      )}

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {EQUIPMENT_PM_ITEMS.map((item) => {
          const checked = Boolean(checklist[item.id]?.checked);
          return (
            <li key={item.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-sm',
                  checked
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-ink-100 bg-white'
                )}
              >
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
      {msg && (
        <p
          className={cn(
            'text-sm',
            /sql|error|fail|column/i.test(msg)
              ? 'text-red-700'
              : 'text-emerald-700'
          )}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
