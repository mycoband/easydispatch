'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/jobs/totals';
import {
  marginTone,
  type JobCostingResult,
} from '@/lib/jobs/costing';
import { cn } from '@/lib/utils';

export function JobCostingPanel({
  snapshot,
  coachEnabled = true,
}: {
  snapshot: JobCostingResult;
  coachEnabled?: boolean;
}) {
  const tone = marginTone(snapshot.margin_pct, snapshot.target_margin_pct);
  const [coach, setCoach] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askCoach() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/margin-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costing: snapshot }),
      });
      const data = (await res.json()) as { advice?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Coach failed');
      setCoach(data.advice || 'No advice.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coach failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Job costing
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Sold vs cost — target margin {snapshot.target_margin_pct}%
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            tone === 'good' && 'bg-emerald-50 text-emerald-800',
            tone === 'warn' && 'bg-amber-50 text-amber-900',
            tone === 'bad' && 'bg-red-50 text-red-800',
            tone === 'neutral' && 'bg-ink-50 text-ink-600'
          )}
        >
          {snapshot.margin_pct == null
            ? 'No margin yet'
            : `${snapshot.margin_pct.toFixed(1)}% margin`}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Sold (pre-tax)" value={formatMoney(snapshot.revenue)} />
        <Stat label="Total cost" value={formatMoney(snapshot.total_cost)} />
        <Stat
          label="Gross profit"
          value={formatMoney(snapshot.gross_profit)}
          emphasize={snapshot.gross_profit >= 0 ? 'good' : 'bad'}
        />
        <Stat
          label="Margin"
          value={
            snapshot.margin_pct == null
              ? '—'
              : `${snapshot.margin_pct.toFixed(1)}%`
          }
          emphasize={tone === 'neutral' ? undefined : tone}
        />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">Materials / parts</p>
          <p className="font-medium">{formatMoney(snapshot.material_cost)}</p>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">Labor</p>
          <p className="font-medium">{formatMoney(snapshot.labor_cost)}</p>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <p className="text-xs text-ink-500">Overhead</p>
          <p className="font-medium">{formatMoney(snapshot.overhead_cost)}</p>
        </div>
      </div>

      {snapshot.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {snapshot.flags.map((f) => (
            <span
              key={f}
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
            >
              {flagLabel(f)}
            </span>
          ))}
        </div>
      )}

      {coachEnabled && (
        <div className="space-y-2 border-t border-ink-100 pt-3">
          <button
            type="button"
            onClick={() => void askCoach()}
            disabled={loading}
            className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50"
          >
            {loading ? 'Thinking…' : 'AI margin coach'}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {coach && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
              {coach}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          emphasize === 'good' && 'text-emerald-700',
          emphasize === 'warn' && 'text-amber-800',
          emphasize === 'bad' && 'text-red-700',
          !emphasize && 'text-ink-950'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function flagLabel(flag: string) {
  switch (flag) {
    case 'below_target_margin':
      return 'Below target margin';
    case 'missing_part_costs':
      return 'Missing part costs';
    case 'hours_without_wage':
      return 'Hours but no tech wage';
    case 'zero_cost_job':
      return 'Zero cost on file';
    case 'labor_line_vs_clock_mismatch':
      return 'Labor lines ≠ clock hours';
    default:
      return flag;
  }
}
