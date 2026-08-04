'use client';

import { useState } from 'react';
import type { ExportKind } from '@/lib/export/kinds';
import { isIosSafari, isStandaloneDisplay } from '@/lib/ui/platform';

function monthStartDateStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

const EXPORTS: {
  kind: ExportKind;
  label: string;
  description: string;
  usesDateRange: boolean;
}[] = [
  {
    kind: 'paid',
    label: 'Paid invoices / jobs',
    description:
      'Date, job #, customer, amount, tax, total, payment method & status — ready for QuickBooks bank deposits.',
    usesDateRange: true,
  },
  {
    kind: 'unpaid',
    label: 'Unpaid AR',
    description:
      'Sent invoices that are still outstanding, for aging / collections.',
    usesDateRange: true,
  },
  {
    kind: 'customers',
    label: 'Customers',
    description: 'Name, phone, email and address for every customer.',
    usesDateRange: false,
  },
  {
    kind: 'job_costing',
    label: 'Job costing (P&L)',
    description:
      'Per-job sold, materials/labor/overhead cost, gross profit, and margin % — for your accountant or boss.',
    usesDateRange: true,
  },
  {
    kind: 'tech_pnl',
    label: 'Tech P&L summary',
    description:
      'Profit rollup by technician: jobs, hours, sold, cost, margin, and paid revenue.',
    usesDateRange: true,
  },
  {
    kind: 'timesheets',
    label: 'Payroll timesheets',
    description:
      'Clocked job hours by tech for your pay period — regular vs overtime (weekly 40), job #, start/end. Import into Gusto, ADP, or QuickBooks Payroll. Not full payroll (no direct deposit or tax filing).',
    usesDateRange: true,
  },
];

export function ExportPanel({
  jobCostingEnabled = false,
}: {
  jobCostingEnabled?: boolean;
}) {
  const [from, setFrom] = useState(monthStartDateStr());
  const [to, setTo] = useState(todayDateStr());
  const [pending, setPending] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exports = EXPORTS.filter(
    (e) =>
      jobCostingEnabled ||
      (e.kind !== 'job_costing' && e.kind !== 'tech_pnl')
  );

  async function download(kind: ExportKind, usesDateRange: boolean) {
    setPending(kind);
    setError(null);
    setMessage(null);
    try {
      const qs = usesDateRange ? `?from=${from}&to=${to}` : '';
      const href = `/api/export/${kind}${qs}`;
      // iOS / installed PWA: blob + <a download> often fails — open the CSV URL
      if (isStandaloneDisplay() || isIosSafari()) {
        window.location.assign(href);
        setMessage('Opening CSV…');
        return;
      }
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `${kind}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-ink-400">
          Applies to date-ranged exports (invoices, AR, job costing, tech
          P&amp;L, timesheets). Timesheets use clock-out date.
        </p>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {exports.map((exp) => (
          <section key={exp.kind} className="panel flex flex-col p-5">
            <h2 className="font-display text-lg font-semibold text-ink-950">
              {exp.label}
            </h2>
            <p className="mt-1 flex-1 text-sm text-ink-500">
              {exp.description}
            </p>
            <button
              type="button"
              disabled={pending === exp.kind}
              onClick={() => download(exp.kind, exp.usesDateRange)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending === exp.kind ? 'Preparing…' : 'Download CSV'}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
