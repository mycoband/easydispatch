'use client';

import { useState } from 'react';
import { saveTechWage } from '@/app/dashboard/settings/costing-actions';

export type TechWageRow = {
  id: string;
  full_name: string | null;
  role: string;
  hourly_cost: number | null;
  burden_pct: number | null;
};

export function TechWagesEditor({ techs }: { techs: TechWageRow[] }) {
  if (!techs.length) {
    return (
      <p className="text-sm text-ink-500">No techs on the roster yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Labor cost on jobs = hours × wage × (1 + burden%). Leave burden blank to
        use the company default.
      </p>
      {techs.map((t) => (
        <TechWageRowEditor key={t.id} tech={t} />
      ))}
    </div>
  );
}

function TechWageRowEditor({ tech }: { tech: TechWageRow }) {
  const [hourly, setHourly] = useState(
    tech.hourly_cost != null ? String(tech.hourly_cost) : ''
  );
  const [burden, setBurden] = useState(
    tech.burden_pct != null ? String(tech.burden_pct) : ''
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    setErr(null);
    const result = await saveTechWage(
      tech.id,
      hourly.trim() === '' ? null : Number(hourly),
      burden.trim() === '' ? null : Number(burden)
    );
    if (result.error) setErr(result.error);
    else setMsg(result.success || 'Saved');
    setPending(false);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-200 bg-ink-50/40 p-3">
      <div className="min-w-[140px] flex-1">
        <p className="text-sm font-semibold text-ink-900">
          {tech.full_name || 'Unnamed'}
        </p>
        <p className="text-xs text-ink-500">{tech.role}</p>
      </div>
      <label className="block w-28">
        <span className="mb-1 block text-xs text-ink-500">$/hr cost</span>
        <input
          type="number"
          step="0.01"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
          className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block w-28">
        <span className="mb-1 block text-xs text-ink-500">Burden %</span>
        <input
          type="number"
          step="0.1"
          value={burden}
          onChange={(e) => setBurden(e.target.value)}
          placeholder="default"
          className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={pending}
        className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? '…' : 'Save'}
      </button>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
