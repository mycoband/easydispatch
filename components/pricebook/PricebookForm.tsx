'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ActionState } from '@/app/dashboard/pricebook/actions';

const initialState: ActionState = {};

export type PricebookFormValues = {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  unit_price?: number | string | null;
  unit_cost?: number | string | null;
  item_type?: string | null;
  taxable?: boolean | null;
};

export function PricebookForm({
  action,
  initial,
  submitLabel = 'Add to pricebook',
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: PricebookFormValues;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.success) {
      if (!initial) formRef.current?.reset();
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state.success, initial, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 sm:grid-cols-2"
    >
      {state.error && (
        <p className="sm:col-span-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="sm:col-span-2 text-sm text-emerald-700">{state.success}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Category</span>
        <input
          name="category"
          defaultValue={initial?.category ?? 'Labor'}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Description</span>
        <input
          name="description"
          defaultValue={initial?.description ?? ''}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Sell price</span>
        <input
          name="unit_price"
          type="number"
          step="0.01"
          defaultValue={
            initial?.unit_price !== undefined && initial?.unit_price !== null
              ? Number(initial.unit_price)
              : 0
          }
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Your cost</span>
        <input
          name="unit_cost"
          type="number"
          step="0.01"
          defaultValue={
            initial?.unit_cost !== undefined && initial?.unit_cost !== null
              ? Number(initial.unit_cost)
              : 0
          }
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Type</span>
        <select
          name="item_type"
          defaultValue={initial?.item_type || 'other'}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          <option value="labor">Labor</option>
          <option value="parts">Parts</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input
          name="taxable"
          type="checkbox"
          defaultChecked={initial?.taxable ?? true}
        />
        Taxable
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
