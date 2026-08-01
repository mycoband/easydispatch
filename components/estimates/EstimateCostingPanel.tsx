'use client';

import { formatMoney } from '@/lib/jobs/totals';
import { marginTone, type JobCostingResult } from '@/lib/jobs/costing';
import { cn } from '@/lib/utils';

/** Pre-send quote P&L — same math as jobs, usually without clocked labor. */
export function EstimateCostingPanel({
  snapshot,
}: {
  snapshot: JobCostingResult;
}) {
  const tone = marginTone(snapshot.margin_pct, snapshot.target_margin_pct);

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Quote costing (before you send)
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Sold vs your cost on this estimate · target{' '}
            {snapshot.target_margin_pct}%
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
            ? 'Add costs on lines'
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

      {snapshot.below_target && snapshot.margin_pct != null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Below target margin — raise sell prices or check line costs before
          sending this quote.
        </p>
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
