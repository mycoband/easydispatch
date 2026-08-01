'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  deleteProperty,
  upsertProperty,
  type ActionState,
} from '@/app/dashboard/properties/actions';
import { formatAddress } from '@/lib/utils';

export type PropertyRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  access_notes: string | null;
  gate_code: string | null;
  lockbox_code: string | null;
  notes: string | null;
  is_primary: boolean | null;
};

export function PropertiesSection({
  customerId,
  properties,
}: {
  customerId: string;
  properties: PropertyRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function startJobForSite(propertyId: string) {
    router.push(
      `/dashboard/jobs/new?customerId=${encodeURIComponent(customerId)}&propertyId=${encodeURIComponent(propertyId)}`
    );
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Sites / properties
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Separate addresses under one customer. Double-click a site to start
            a new job there.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add site
          </button>
        )}
      </div>

      {message && (
        <p className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
          {message}
        </p>
      )}

      {adding && (
        <div className="mb-4">
          <PropertyForm
            action={async (prev, fd) => {
              const result = await upsertProperty(customerId, null, prev, fd);
              if (result.success) setAdding(false);
              setMessage(result.error || result.success || null);
              return result;
            }}
            onCancel={() => setAdding(false)}
            submitLabel="Add site"
          />
        </div>
      )}

      {properties.length === 0 && !adding ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          No sites yet. Add the primary service address.
        </p>
      ) : (
        <ul className="space-y-3">
          {properties.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/20"
              onDoubleClick={(e) => {
                if (editingId === p.id) return;
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input, textarea, select')) return;
                startJobForSite(p.id);
              }}
              title="Double-click to create a job for this site"
            >
              {editingId === p.id ? (
                <PropertyForm
                  initial={p}
                  action={async (prev, fd) => {
                    const result = await upsertProperty(
                      customerId,
                      p.id,
                      prev,
                      fd
                    );
                    if (result.success) setEditingId(null);
                    setMessage(result.error || result.success || null);
                    return result;
                  }}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save site"
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 cursor-pointer">
                    <p className="font-medium text-ink-900">
                      {p.name}
                      {p.is_primary ? (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {formatAddress(p) || 'No address'}
                    </p>
                    {(p.gate_code || p.lockbox_code || p.access_notes) && (
                      <p className="mt-2 text-sm text-sky-900">
                        {[
                          p.gate_code && `Gate ${p.gate_code}`,
                          p.lockbox_code && `Lockbox ${p.lockbox_code}`,
                          p.access_notes,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-ink-400">
                      Double-click for new job
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startJobForSite(p.id)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      New job
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id);
                        setAdding(false);
                      }}
                      className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Remove this site?')) return;
                        const result = await deleteProperty(customerId, p.id);
                        setMessage(result.error || result.success || null);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PropertyForm({
  action,
  initial,
  onCancel,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Partial<PropertyRow>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/30 p-4"
      action={async (fd) => {
        setPending(true);
        setError(null);
        const result = await action({}, fd);
        if (result.error) setError(result.error);
        setPending(false);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Site name
          </span>
          <input
            name="name"
            required
            defaultValue={initial?.name || ''}
            placeholder="Primary · Unit B · Warehouse"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Street
          </span>
          <input
            name="address"
            defaultValue={initial?.address || ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">City</span>
          <input
            name="city"
            defaultValue={initial?.city || ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              State
            </span>
            <input
              name="state"
              defaultValue={initial?.state || 'MO'}
              maxLength={2}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm uppercase"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">ZIP</span>
            <input
              name="zip"
              defaultValue={initial?.zip || ''}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Gate code
          </span>
          <input
            name="gate_code"
            defaultValue={initial?.gate_code || ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Lockbox
          </span>
          <input
            name="lockbox_code"
            defaultValue={initial?.lockbox_code || ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Access notes
          </span>
          <textarea
            name="access_notes"
            rows={2}
            defaultValue={initial?.access_notes || ''}
            placeholder="Dog, HOA, roof hatch, parking…"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
          <input
            type="checkbox"
            name="is_primary"
            value="on"
            defaultChecked={Boolean(initial?.is_primary ?? !initial?.id)}
          />
          Primary site (syncs to customer address)
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
