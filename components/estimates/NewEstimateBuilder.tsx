'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimateWithItems } from '@/app/dashboard/estimates/actions';
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

export function NewEstimateBuilder({
  customers,
  taxRates,
  initialCustomerId,
  jobId,
  jobNumber,
  customerLocked = false,
  successHref,
  presets = [],
}: {
  customers: Customer[];
  taxRates: TaxRate[];
  initialCustomerId?: string;
  jobId?: string | null;
  jobNumber?: string | null;
  customerLocked?: boolean;
  /** Where to go after create (tech vs office). Defaults to office estimate detail. */
  successHref?: (id: string) => string;
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
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);

  const taxRate = useMemo(() => {
    const found = taxRates.find((t) => t.id === taxRateId);
    return Number(found?.rate) || 0;
  }, [taxRates, taxRateId]);

  const totals = useMemo(
    () =>
      computeJobTotals(
        rows.map((r) => ({
          qty: Number(r.qty) || 0,
          unit_price: Number(r.unit_price) || 0,
          taxable: r.taxable,
        })),
        taxRate
      ),
    [rows, taxRate]
  );

  const customerName =
    customers.find((c) => c.id === customerId)?.name || 'Customer';

  function addPreset(preset: PricebookPreset) {
    setRows((prev) => {
      const emptyOnly = prev.length === 1 && !prev[0].description.trim();
      const next = newRow({
        description: preset.description,
        qty: String(preset.qty),
        unit_price: String(preset.unit_price),
        taxable: preset.taxable,
      });
      return emptyOnly ? [next] : [...prev, next];
    });
  }

  function submit() {
    setError(null);
    const items = rows
      .filter((r) => r.description.trim())
      .map((r, index) => ({
        description: r.description.trim(),
        qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0,
        taxable: r.taxable,
        sort_order: index,
      }));

    startTransition(async () => {
      const result = await createEstimateWithItems({
        customer_id: customerId,
        description,
        tax_rate_id: taxRateId,
        valid_until: validUntil || null,
        job_id: jobId || null,
        items,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id) {
        router.push(
          successHref
            ? successHref(result.id)
            : `/dashboard/estimates/${result.id}`
        );
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

      {jobId && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-ink-800">
          Linked to job{' '}
          <span className="font-semibold">
            {jobNumber || jobId.slice(0, 8)}
          </span>
          {' · '}
          for <span className="font-semibold">{customerName}</span>
        </div>
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
            {customerLocked ? (
              <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm font-medium text-ink-900">
                {customerName}
              </p>
            ) : (
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
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink-700">
              Description / scope
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Replace failed dual run capacitor on RTU-1, verify amps and pressures"
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

      <section className="panel border-brand-200/60 p-5 ring-1 ring-brand-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Quote pricing
        </p>
        <h2 className="font-display text-xl font-semibold text-ink-950">
          Line items
        </h2>
        <p className="mt-0.5 mb-4 text-sm text-ink-500">
          Build the quote here — you don&apos;t need to create the estimate
          first.
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => addPreset(preset)}
              className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_110px_72px_40px]"
            >
              <input
                value={row.description}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, description: e.target.value }
                        : r
                    )
                  )
                }
                placeholder="Description"
                className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.25"
                value={row.qty}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, qty: e.target.value } : r
                    )
                  )
                }
                className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.unit_price}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, unit_price: e.target.value }
                        : r
                    )
                  )
                }
                className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
              />
              <label className="flex items-center justify-center rounded-lg border border-ink-200 px-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.taxable}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, taxable: e.target.checked }
                          : r
                      )
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setRows((prev) =>
                    prev.length === 1
                      ? [newRow()]
                      : prev.filter((r) => r.key !== row.key)
                  )
                }
                className="rounded-lg border border-ink-200 text-ink-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium hover:bg-ink-50"
          >
            Add blank line
          </button>
          <div className="min-w-[200px] rounded-xl bg-ink-950 px-4 py-3 text-sm text-white">
            <div className="flex justify-between text-ink-300">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-ink-300">
              <span>Tax</span>
              <span>{formatMoney(totals.tax_amount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-ink-700 pt-2 font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        disabled={pending || !customerId || !description.trim()}
        onClick={submit}
        className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create estimate with line items'}
      </button>
    </div>
  );
}
