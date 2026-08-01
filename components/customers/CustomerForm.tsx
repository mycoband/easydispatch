'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/dashboard/customers/actions';

type CustomerValues = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  access_notes?: string | null;
};

const initialState: ActionState = {};

export function CustomerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: CustomerValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Customer / property name
        </span>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ''}
            placeholder="Acme Fitness — Main St"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Street address
        </span>
        <input
          name="address"
          defaultValue={initial?.address ?? ''}
          placeholder="1234 N 291 Hwy"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">City</span>
          <input
            name="city"
            defaultValue={initial?.city ?? ''}
            placeholder="City"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">State</span>
          <input
            name="state"
            defaultValue={initial?.state ?? 'MO'}
            maxLength={2}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm uppercase outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">ZIP</span>
          <input
            name="zip"
            defaultValue={initial?.zip ?? ''}
            placeholder="64108"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Phone</span>
          <input
            name="phone"
            type="tel"
            defaultValue={initial?.phone ?? ''}
            placeholder="(816) 555-0192"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            placeholder="manager@example.com"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Site access
          <span className="ml-2 font-normal text-ink-400">
            gate codes, lockbox, dogs, roof access
          </span>
        </span>
        <textarea
          name="access_notes"
          rows={2}
          defaultValue={initial?.access_notes ?? ''}
          placeholder="Gate #1234 · dog in backyard · roof hatch NE"
          className="w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm outline-none ring-amber-500/20 focus:ring-4"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Office notes
          <span className="ml-2 font-normal text-ink-400">internal</span>
        </span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ''}
          placeholder="Billing prefs, decision maker, HOA rules…"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

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
