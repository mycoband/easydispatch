'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/dashboard/agreements/actions';

const initial: ActionState = {};

export function AgreementCreateForm({
  action,
  customers,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {state.error && (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Customer</span>
        <select
          name="customer_id"
          required
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Plan name</span>
        <input
          name="plan_name"
          required
          placeholder="Gold PM · 4 visits"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Type</span>
        <select
          name="agreement_type"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          <option value="pm">PM / maintenance</option>
          <option value="membership">Membership</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Visits / year</span>
        <input
          name="visits_per_year"
          type="number"
          defaultValue={4}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Monthly $</span>
        <input
          name="monthly_amount"
          type="number"
          step="0.01"
          defaultValue={0}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Next due (PM)</span>
        <input
          name="next_due_date"
          type="date"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Billing interval
        </span>
        <select
          name="billing_interval"
          defaultValue="monthly"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="none">None</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Next bill date
        </span>
        <input
          name="next_bill_date"
          type="date"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Status</span>
        <select
          name="status"
          defaultValue="Active"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          <option>Active</option>
          <option>Paused</option>
          <option>Cancelled</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Notes</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending || customers.length === 0}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:col-span-2"
      >
        {pending ? 'Saving…' : 'Create agreement'}
      </button>
    </form>
  );
}
