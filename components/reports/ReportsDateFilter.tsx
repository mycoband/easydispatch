'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReportsDateFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function apply(nextFrom = fromVal, nextTo = toVal) {
    const params = new URLSearchParams();
    params.set('from', nextFrom);
    params.set('to', nextTo);
    router.push(`/dashboard/reports?${params.toString()}`);
  }

  function preset(days: number | 'mtd') {
    const end = new Date();
    const start = new Date();
    if (days === 'mtd') {
      start.setDate(1);
    } else {
      start.setDate(end.getDate() - days);
    }
    const f = start.toISOString().slice(0, 10);
    const t = end.toISOString().slice(0, 10);
    setFromVal(f);
    setToVal(t);
    apply(f, t);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1">
        {[
          { label: 'MTD', fn: () => preset('mtd') },
          { label: '30d', fn: () => preset(30) },
          { label: '90d', fn: () => preset(90) },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={p.fn}
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">From</span>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">To</span>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() => apply()}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Apply
      </button>
    </div>
  );
}
