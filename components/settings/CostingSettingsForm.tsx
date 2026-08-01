'use client';

import { useActionState } from 'react';
import {
  saveCostingSettings,
  type ActionState,
} from '@/app/dashboard/settings/costing-actions';
import type { CostingSettings } from '@/lib/jobs/costing';

const initial: ActionState = {};

export function CostingSettingsForm({
  initialCosting,
}: {
  initialCosting: CostingSettings;
}) {
  const [state, action, pending] = useActionState(saveCostingSettings, initial);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <p className="sm:col-span-2 text-sm text-ink-500">
        Used for job P&L, margin targets, and AI margin coaching. Turn the
        feature off under Feature modules if you don&apos;t want costing.
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Target margin %</span>
        <input
          name="target_margin_pct"
          type="number"
          step="0.1"
          defaultValue={initialCosting.target_margin_pct}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Default burden % (taxes/benefits)
        </span>
        <input
          name="default_burden_pct"
          type="number"
          step="0.1"
          defaultValue={initialCosting.default_burden_pct}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Default tech labor cost $/hr
        </span>
        <input
          name="default_labor_cost_per_hour"
          type="number"
          step="0.01"
          defaultValue={initialCosting.default_labor_cost_per_hour}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Overhead $/hour on job
        </span>
        <input
          name="overhead_per_hour"
          type="number"
          step="0.01"
          defaultValue={initialCosting.overhead_per_hour}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Overhead % of revenue
        </span>
        <input
          name="overhead_pct_of_revenue"
          type="number"
          step="0.1"
          defaultValue={initialCosting.overhead_pct_of_revenue}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-ink-700">
        <input
          name="tech_see_costs"
          type="checkbox"
          defaultChecked={initialCosting.tech_see_costs}
        />
        Techs can see job cost / margin
      </label>
      <div className="sm:col-span-2 rounded-lg border border-ink-100 bg-ink-50/60 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
          <input
            name="weekly_digest_enabled"
            type="checkbox"
            defaultChecked={initialCosting.weekly_digest_enabled}
          />
          Weekly owner profit digest (email)
        </label>
        <p className="text-xs text-ink-500">
          Mondays ~7am PT: last week&apos;s sold, cost, profit, margin, by-tech
          rollup, and lowest-profit jobs. Needs Resend email configured on the
          server.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Digest email (optional)
          </span>
          <input
            name="weekly_digest_email"
            type="email"
            placeholder="Defaults to company email"
            defaultValue={initialCosting.weekly_digest_email}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save costing settings'}
        </button>
        {state.error && (
          <span className="text-sm text-red-700">{state.error}</span>
        )}
        {state.success && (
          <span className="text-sm text-emerald-700">{state.success}</span>
        )}
      </div>
    </form>
  );
}
