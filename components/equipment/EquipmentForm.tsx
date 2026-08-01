'use client';

import { useActionState } from 'react';
import type { ActionState } from '@/app/dashboard/customers/actions';
import { EQUIPMENT_TYPES } from '@/lib/validations/equipment';

type EquipmentValues = {
  name?: string | null;
  equipment_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  capacity?: string | null;
  electrical?: string | null;
  refrigerant?: string | null;
  filter_size?: string | null;
  filter_qty?: number | string | null;
  install_date?: string | null;
  property_id?: string | null;
  warranty_parts_expires?: string | null;
  warranty_labor_expires?: string | null;
  warranty_notes?: string | null;
  notes?: string | null;
};

type PropertyOption = { id: string; name: string };

const initialState: ActionState = {};

export function EquipmentForm({
  action,
  initial,
  submitLabel,
  onCancel,
  properties = [],
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: EquipmentValues;
  submitLabel: string;
  onCancel?: () => void;
  properties?: PropertyOption[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const typeValue = initial?.equipment_type ?? 'RTU';
  const knownType = EQUIPMENT_TYPES.includes(
    typeValue as (typeof EQUIPMENT_TYPES)[number]
  );

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Name / label
          </span>
          <input
            name="name"
            defaultValue={initial?.name ?? ''}
            placeholder="RTU 1"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">Type</span>
          <select
            name="equipment_type"
            defaultValue={knownType ? typeValue : 'Other'}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          >
            {EQUIPMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Manufacturer
          </span>
          <input
            name="manufacturer"
            defaultValue={initial?.manufacturer ?? ''}
            placeholder="Carrier"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">Model</span>
          <input
            name="model"
            defaultValue={initial?.model ?? ''}
            placeholder="48FC"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Serial number
          </span>
          <input
            name="serial_number"
            defaultValue={initial?.serial_number ?? ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Capacity
          </span>
          <input
            name="capacity"
            defaultValue={initial?.capacity ?? ''}
            placeholder="10 ton"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Electrical
          </span>
          <input
            name="electrical"
            defaultValue={initial?.electrical ?? ''}
            placeholder="208/230V 3Ph"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Refrigerant
          </span>
          <input
            name="refrigerant"
            defaultValue={initial?.refrigerant ?? ''}
            placeholder="R-410A"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Filter size
          </span>
          <input
            name="filter_size"
            defaultValue={initial?.filter_size ?? ''}
            placeholder="16x25x1"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Filter qty
          </span>
          <input
            name="filter_qty"
            type="number"
            min={0}
            max={99}
            defaultValue={
              initial?.filter_qty === null || initial?.filter_qty === undefined
                ? ''
                : String(initial.filter_qty)
            }
            placeholder="2"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Install date
          </span>
          <input
            name="install_date"
            type="date"
            defaultValue={initial?.install_date ?? ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        {properties.length > 0 && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Site
            </span>
            <select
              name="property_id"
              defaultValue={initial?.property_id ?? ''}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
            >
              <option value="">— Primary / any —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Parts warranty ends
          </span>
          <input
            name="warranty_parts_expires"
            type="date"
            defaultValue={initial?.warranty_parts_expires ?? ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Labor warranty ends
          </span>
          <input
            name="warranty_labor_expires"
            type="date"
            defaultValue={initial?.warranty_labor_expires ?? ''}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Warranty notes
          </span>
          <input
            name="warranty_notes"
            defaultValue={initial?.warranty_notes ?? ''}
            placeholder="Manufacturer 10yr heat exchanger · labor 1yr…"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-600">Notes</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ''}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
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

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
