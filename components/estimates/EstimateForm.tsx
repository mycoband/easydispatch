'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/dashboard/estimates/actions';
import { ESTIMATE_STATUSES } from '@/lib/validations/estimate';

const initialState: ActionState = {};

export function EstimateForm({
  action,
  customers,
  taxRates,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customers: { id: string; name: string }[];
  taxRates: { id: string; name: string; rate: number }[];
  initial?: {
    customer_id?: string | null;
    description?: string | null;
    status?: string | null;
    tax_rate_id?: string | null;
    valid_until?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">
          Customer
        </span>
        <select
          name="customer_id"
          required
          defaultValue={initial?.customer_id || customers[0]?.id || ''}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">
          Description
        </span>
        <textarea
          name="description"
          required
          rows={4}
          defaultValue={initial?.description || ''}
          placeholder="Scope of work / quote summary"
          className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Status
          </span>
          <select
            name="status"
            defaultValue={initial?.status || 'Draft'}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
          >
            {ESTIMATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Tax rate
          </span>
          <select
            name="tax_rate_id"
            defaultValue={initial?.tax_rate_id || 'kcmo-jackson'}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
          >
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Valid until
          </span>
          <input
            type="date"
            name="valid_until"
            defaultValue={initial?.valid_until?.slice(0, 10) || ''}
            className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
