'use client';

import { useMemo, useState } from 'react';
import { saveEstimateLineItems } from '@/app/dashboard/estimates/actions';
import type { PricebookPreset } from '@/lib/pricebook/load';
import { computeJobTotals, formatMoney } from '@/lib/jobs/totals';

type TaxRate = { id: string; name: string; rate: number };
type Row = {
  key: string;
  description: string;
  qty: string;
  unit_price: string;
  unit_cost: string;
  item_type: 'labor' | 'parts' | 'other';
  taxable: boolean;
};

function newRow(partial?: Partial<Omit<Row, 'key'>>): Row {
  return {
    key: crypto.randomUUID(),
    description: partial?.description || '',
    qty: partial?.qty || '1',
    unit_price: partial?.unit_price || '0',
    unit_cost: partial?.unit_cost || '0',
    item_type: partial?.item_type || 'other',
    taxable: partial?.taxable ?? true,
  };
}

export function EstimateLineItemsEditor({
  estimateId,
  taxRates,
  initialTaxRateId,
  initialItems,
  presets = [],
  showCosts = false,
}: {
  estimateId: string;
  taxRates: TaxRate[];
  initialTaxRateId: string;
  initialItems: {
    description: string;
    qty: number;
    unit_price: number;
    unit_cost?: number;
    item_type?: string | null;
    taxable: boolean;
  }[];
  presets?: PricebookPreset[];
  showCosts?: boolean;
}) {
  const [taxRateId, setTaxRateId] = useState(initialTaxRateId || 'kcmo-jackson');
  const [rows, setRows] = useState<Row[]>(
    initialItems.length
      ? initialItems.map((item) =>
          newRow({
            description: item.description,
            qty: String(item.qty),
            unit_price: String(item.unit_price),
            unit_cost: String(item.unit_cost ?? 0),
            item_type:
              item.item_type === 'labor' || item.item_type === 'parts'
                ? item.item_type
                : 'other',
            taxable: item.taxable,
          })
        )
      : [newRow()]
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const taxRate = useMemo(() => {
    const found = taxRates.find((t) => t.id === taxRateId);
    return Number(found?.rate) || 0;
  }, [taxRates, taxRateId]);

  const totals = useMemo(() => {
    return computeJobTotals(
      rows.map((r) => ({
        qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0,
        taxable: r.taxable,
      })),
      taxRate
    );
  }, [rows, taxRate]);

  function addPreset(preset: PricebookPreset) {
    setRows((prev) => {
      const emptyOnly =
        prev.length === 1 && !prev[0].description.trim();
      const next = newRow({
        description: preset.description,
        qty: String(preset.qty),
        unit_price: String(preset.unit_price),
        unit_cost: String(preset.unit_cost ?? 0),
        item_type: preset.item_type || 'other',
        taxable: preset.taxable,
      });
      return emptyOnly ? [next] : [...prev, next];
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const items = rows
        .filter((r) => r.description.trim())
        .map((r, index) => ({
          description: r.description.trim(),
          qty: Number(r.qty) || 0,
          unit_price: Number(r.unit_price) || 0,
          unit_cost: showCosts ? Number(r.unit_cost) || 0 : 0,
          item_type: showCosts ? r.item_type : 'other',
          taxable: r.taxable,
          sort_order: index,
        }));

      const result = await saveEstimateLineItems(
        estimateId,
        JSON.stringify({ tax_rate_id: taxRateId, items })
      );
      if (result.error) throw new Error(result.error);
      setMessage(result.success || 'Saved');
      if (items.length === 0) setRows([newRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const grid = showCosts
    ? 'sm:grid-cols-[minmax(0,1fr)_72px_88px_88px_88px_64px_40px]'
    : 'sm:grid-cols-[minmax(0,1fr)_88px_110px_72px_40px]';

  return (
    <section className="panel border-brand-200/60 p-5 ring-1 ring-brand-100">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Quote pricing
          </p>
          <h2 className="font-display text-xl font-semibold text-ink-950">
            Line items
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {showCosts
              ? 'Sell and cost — check quote margin before you send.'
              : 'Add labor and parts — totals update with tax.'}
          </p>
        </div>
        <label className="block min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-ink-600">
            Tax rate
          </span>
          <select
            value={taxRateId}
            onChange={(e) => setTaxRateId(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
          >
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({(Number(t.rate) * 100).toFixed(3)}%)
              </option>
            ))}
          </select>
        </label>
      </div>

      {presets.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label + preset.unit_price}
              type="button"
              onClick={() => addPreset(preset)}
              className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`mb-2 hidden gap-2 text-xs font-medium uppercase tracking-wide text-ink-400 sm:grid ${grid}`}
      >
        <span>Description</span>
        <span>Qty</span>
        <span>Sell $</span>
        {showCosts && <span>Cost $</span>}
        {showCosts && <span>Type</span>}
        <span>Tax</span>
        <span />
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className={`grid gap-2 ${grid}`}>
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
              placeholder="e.g. Labor – diagnose, dual run capacitor"
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
            {showCosts && (
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.unit_cost}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, unit_cost: e.target.value }
                        : r
                    )
                  )
                }
                className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
              />
            )}
            {showCosts && (
              <select
                value={row.item_type}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? {
                            ...r,
                            item_type: e.target.value as Row['item_type'],
                          }
                        : r
                    )
                  )
                }
                className="rounded-lg border border-ink-200 px-2 py-2.5 text-sm"
              >
                <option value="parts">Parts</option>
                <option value="labor">Labor</option>
                <option value="other">Other</option>
              </select>
            )}
            <label className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-2 text-sm text-ink-600">
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
              <span className="sm:hidden">Tax</span>
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
              className="rounded-lg border border-ink-200 text-sm text-ink-500 hover:bg-ink-50"
              aria-label="Remove line"
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
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Add blank line
        </button>
        <div className="min-w-[220px] rounded-xl bg-ink-950 px-4 py-3 text-sm text-white">
          <div className="flex justify-between gap-6 text-ink-300">
            <span>Subtotal</span>
            <span>{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-6 text-ink-300">
            <span>Tax</span>
            <span>{formatMoney(totals.tax_amount)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-6 border-t border-ink-700 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save line items'}
        </button>
        {message && <span className="text-sm text-emerald-700">{message}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </section>
  );
}
