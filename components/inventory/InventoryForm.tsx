'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/dashboard/inventory/actions';

const initial: ActionState = {};

export function InventoryForm({
  action,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      {state.error && (
        <p className="sm:col-span-3 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="sm:col-span-3 text-sm text-emerald-700">{state.success}</p>
      )}
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input
          name="name"
          required
          placeholder="Dual run capacitor 40/5"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">SKU</span>
        <input
          name="sku"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Qty on hand</span>
        <input
          name="qty_on_hand"
          type="number"
          step="1"
          defaultValue={0}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Min qty</span>
        <input
          name="min_qty"
          type="number"
          step="1"
          defaultValue={2}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Location</span>
        <input
          name="location"
          placeholder="Truck 1"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Cost</span>
        <input
          name="cost"
          type="number"
          step="0.01"
          defaultValue={0}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Sell price</span>
        <input
          name="sell_price"
          type="number"
          step="0.01"
          defaultValue={0}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-3"
      >
        {pending ? 'Saving…' : 'Add to inventory'}
      </button>
    </form>
  );
}
