'use client';

import { useMemo, useState } from 'react';
import { saveJobLineItems } from '@/app/dashboard/jobs/actions';
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

export function LineItemsEditor({
  jobId,
  taxRates,
  initialTaxRateId,
  initialItems,
  presets = [],
  showCosts = false,
  canEditCosts = false,
}: {
  jobId: string;
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
  canEditCosts?: boolean;
}) {
  const [taxRateId, setTaxRateId] = useState(initialTaxRateId || 'kcmo-jackson');
  const [rows, setRows] = useState<Row[]>(
    initialItems.length
      ? initialItems.map((item) => ({
          key: crypto.randomUUID(),
          description: item.description,
          qty: String(item.qty),
          unit_price: String(item.unit_price),
          unit_cost: String(item.unit_cost ?? 0),
          item_type:
            item.item_type === 'labor' || item.item_type === 'parts'
              ? item.item_type
              : 'other',
          taxable: item.taxable,
        }))
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

  const costTotal = useMemo(
    () =>
      rows.reduce(
        (s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_cost) || 0),
        0
      ),
    [rows]
  );

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

      const result = await saveJobLineItems(
        jobId,
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
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Line items
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {showCosts
              ? 'Parts and labor with sell price and cost.'
              : 'Parts and labor with tax.'}
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

      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() =>
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
              })
            }
            className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50"
          >
            + {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div
          className={`hidden gap-2 text-xs font-medium uppercase tracking-wide text-ink-400 sm:grid ${grid}`}
        >
          <span>Description</span>
          <span>Qty</span>
          <span>Sell $</span>
          {showCosts && <span>Cost $</span>}
          {showCosts && <span>Type</span>}
          <span>Tax</span>
          <span />
        </div>
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
              placeholder="Labor - diagnose / capacitor"
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
            />
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-ink-500 sm:hidden">
                Qty
              </span>
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
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-ink-500 sm:hidden">
                Sell $
              </span>
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
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </label>
            {showCosts && (
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-ink-500 sm:hidden">
                  Cost $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.unit_cost}
                  disabled={!canEditCosts}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, unit_cost: e.target.value }
                          : r
                      )
                    )
                  }
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm disabled:bg-ink-50"
                />
              </label>
            )}
            {showCosts && (
              <select
                value={row.item_type}
                disabled={!canEditCosts}
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
                className="rounded-lg border border-ink-200 px-2 py-2 text-sm disabled:bg-ink-50"
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
              <span className="sm:hidden">Taxable</span>
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
              className="tap-target inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-200 text-sm text-ink-500 hover:bg-ink-50"
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
          className="inline-flex min-h-11 items-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Add line
        </button>

        <div className="min-w-[200px] rounded-lg bg-ink-50 px-4 py-3 text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-ink-500">Subtotal</span>
            <span>{formatMoney(totals.subtotal)}</span>
          </div>
          {showCosts && (
            <div className="mt-1 flex justify-between gap-6">
              <span className="text-ink-500">Line costs</span>
              <span>{formatMoney(costTotal)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between gap-6">
            <span className="text-ink-500">
              Tax ({(taxRate * 100).toFixed(3)}%)
            </span>
            <span>{formatMoney(totals.tax_amount)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-6 border-t border-ink-200 pt-2 font-semibold text-ink-950">
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
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save line items'}
        </button>
        {message && (
          <span className="text-sm text-emerald-700">{message}</span>
        )}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </section>
  );
}
