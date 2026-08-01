'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createGbbPackage } from '@/app/dashboard/estimates/gbb-actions';
import {
  GBB_OPTION_LABELS,
  type GbbOptionLabel,
} from '@/lib/estimates/gbb';
import type { PricebookPreset } from '@/lib/pricebook/load';
import { computeJobTotals, formatMoney } from '@/lib/jobs/totals';

type TaxRate = { id: string; name: string; rate: number };
type Customer = { id: string; name: string };
type Row = {
  key: string;
  description: string;
  qty: string;
  unit_price: string;
  taxable: boolean;
};

function newRow(partial?: Partial<Omit<Row, 'key'>>): Row {
  return {
    key: crypto.randomUUID(),
    description: partial?.description || '',
    qty: partial?.qty || '1',
    unit_price: partial?.unit_price || '0',
    taxable: partial?.taxable ?? true,
  };
}

type OptionState = {
  label: GbbOptionLabel;
  headline: string;
  rows: Row[];
};

const DEFAULT_HEADLINES: Record<GbbOptionLabel, string> = {
  Good: 'Get it fixed right',
  Better: 'Fix it + protect it',
  Best: 'Full replacement & peace of mind',
};

const CARD_ACCENT: Record<GbbOptionLabel, string> = {
  Good: 'border-ink-200',
  Better: 'border-brand-300 ring-1 ring-brand-100',
  Best: 'border-amber-300 ring-1 ring-amber-100',
};

function emptyOption(label: GbbOptionLabel): OptionState {
  return { label, headline: DEFAULT_HEADLINES[label], rows: [newRow()] };
}

export function GbbPackageBuilder({
  customers,
  taxRates,
  initialCustomerId,
  presets = [],
}: {
  customers: Customer[];
  taxRates: TaxRate[];
  initialCustomerId?: string;
  presets?: PricebookPreset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState(
    initialCustomerId || customers[0]?.id || ''
  );
  const [description, setDescription] = useState('');
  const [taxRateId, setTaxRateId] = useState('kcmo-jackson');
  const [validUntil, setValidUntil] = useState('');
  const [recommended, setRecommended] = useState<GbbOptionLabel>('Better');
  const [options, setOptions] = useState<OptionState[]>(
    GBB_OPTION_LABELS.map((label) => emptyOption(label))
  );
  const [error, setError] = useState<string | null>(null);

  const taxRate = useMemo(() => {
    const found = taxRates.find((t) => t.id === taxRateId);
    return Number(found?.rate) || 0;
  }, [taxRates, taxRateId]);

  const totalsByOption = useMemo(
    () =>
      options.map((opt) =>
        computeJobTotals(
          opt.rows.map((r) => ({
            qty: Number(r.qty) || 0,
            unit_price: Number(r.unit_price) || 0,
            taxable: r.taxable,
          })),
          taxRate
        )
      ),
    [options, taxRate]
  );

  function updateOption(label: GbbOptionLabel, patch: Partial<OptionState>) {
    setOptions((prev) =>
      prev.map((o) => (o.label === label ? { ...o, ...patch } : o))
    );
  }

  function updateRow(label: GbbOptionLabel, key: string, patch: Partial<Row>) {
    setOptions((prev) =>
      prev.map((o) =>
        o.label !== label
          ? o
          : { ...o, rows: o.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }
      )
    );
  }

  function addPreset(label: GbbOptionLabel, preset: PricebookPreset) {
    setOptions((prev) =>
      prev.map((o) => {
        if (o.label !== label) return o;
        const emptyOnly = o.rows.length === 1 && !o.rows[0].description.trim();
        const next = newRow({
          description: preset.description,
          qty: String(preset.qty),
          unit_price: String(preset.unit_price),
          taxable: preset.taxable,
        });
        return { ...o, rows: emptyOnly ? [next] : [...o.rows, next] };
      })
    );
  }

  function addRow(label: GbbOptionLabel) {
    setOptions((prev) =>
      prev.map((o) => (o.label === label ? { ...o, rows: [...o.rows, newRow()] } : o))
    );
  }

  function removeRow(label: GbbOptionLabel, key: string) {
    setOptions((prev) =>
      prev.map((o) =>
        o.label !== label
          ? o
          : {
              ...o,
              rows: o.rows.length === 1 ? [newRow()] : o.rows.filter((r) => r.key !== key),
            }
      )
    );
  }

  function submit() {
    setError(null);
    const payload = options.map((o) => ({
      label: o.label,
      headline: o.headline,
      isRecommended: o.label === recommended,
      items: o.rows
        .filter((r) => r.description.trim())
        .map((r) => ({
          description: r.description.trim(),
          qty: Number(r.qty) || 0,
          unit_price: Number(r.unit_price) || 0,
          taxable: r.taxable,
        })),
    }));

    startTransition(async () => {
      const result = await createGbbPackage({
        customerId,
        description,
        taxRateId,
        validUntil: validUntil || null,
        options: payload,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.estimateIds?.length) {
        router.push(`/dashboard/estimates/${result.estimateIds[0]}`);
      } else {
        router.push('/dashboard/estimates');
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-950">
          Customer & scope
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              Customer
            </span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              Shared description / scope
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Options to address failed condenser fan motor on RTU-2"
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              Tax rate
            </span>
            <select
              value={taxRateId}
              onChange={(e) => setTaxRateId(e.target.value)}
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
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((opt, idx) => (
          <section
            key={opt.label}
            className={`panel space-y-3 border p-4 ${CARD_ACCENT[opt.label]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-ink-950">
                {opt.label}
              </h3>
              <label className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                <input
                  type="radio"
                  name="recommended"
                  checked={recommended === opt.label}
                  onChange={() => setRecommended(opt.label)}
                />
                Recommended
              </label>
            </div>

            <input
              value={opt.headline}
              onChange={(e) => updateOption(opt.label, { headline: e.target.value })}
              placeholder="Headline shown to customer"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
            />

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {presets.slice(0, 6).map((preset) => (
                  <button
                    key={preset.label + preset.unit_price}
                    type="button"
                    onClick={() => addPreset(opt.label, preset)}
                    className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {opt.rows.map((row) => (
                <div key={row.key} className="space-y-1 rounded-lg border border-ink-100 p-2">
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(opt.label, row.key, { description: e.target.value })}
                    placeholder="Description"
                    className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={row.qty}
                      onChange={(e) => updateRow(opt.label, row.key, { qty: e.target.value })}
                      aria-label="Quantity"
                      className="w-16 rounded-md border border-ink-200 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-ink-400">×</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unit_price}
                      onChange={(e) => updateRow(opt.label, row.key, { unit_price: e.target.value })}
                      aria-label="Unit price"
                      className="w-24 flex-1 rounded-md border border-ink-200 px-2 py-1.5 text-sm"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-ink-500">
                      <input
                        type="checkbox"
                        checked={row.taxable}
                        onChange={(e) => updateRow(opt.label, row.key, { taxable: e.target.checked })}
                      />
                      Tax
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(opt.label, row.key)}
                      aria-label="Remove line"
                      className="rounded-md border border-ink-200 px-1.5 text-sm text-ink-500 hover:bg-ink-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addRow(opt.label)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              + Add line
            </button>

            <div className="rounded-xl bg-ink-950 px-3 py-2.5 text-sm text-white">
              <div className="flex justify-between text-ink-300">
                <span>Subtotal</span>
                <span>{formatMoney(totalsByOption[idx].subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-ink-300">
                <span>Tax</span>
                <span>{formatMoney(totalsByOption[idx].tax_amount)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-ink-700 pt-1.5 font-semibold">
                <span>Total</span>
                <span>{formatMoney(totalsByOption[idx].total)}</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        disabled={pending || !customerId}
        onClick={submit}
        className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create Good / Better / Best package'}
      </button>
    </div>
  );
}
