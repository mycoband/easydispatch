'use client';

import { useMemo, useState } from 'react';
import { markInventoryOrdered } from '@/app/dashboard/inventory/actions';

export type ReorderItem = {
  id: string;
  name: string;
  sku: string | null;
  qty_on_hand: number;
  min_qty: number;
  reorder_qty: number | null;
  vendor: string | null;
  cost: number;
  reorder_ordered_at: string | null;
};

function suggestedQty(item: ReorderItem) {
  if (item.reorder_qty != null && item.reorder_qty > 0) {
    return Number(item.reorder_qty);
  }
  const need = Math.max(0, Number(item.min_qty) * 2 - Number(item.qty_on_hand));
  return Math.max(1, Math.ceil(need));
}

export function ReorderPanel({ items }: { items: ReorderItem[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        orderQty: suggestedQty(i),
        lineCost: suggestedQty(i) * (Number(i.cost) || 0),
      })),
    [items]
  );

  const byVendor = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const v = row.vendor?.trim() || 'No vendor';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(row);
    }
    return [...map.entries()];
  }, [rows]);

  function downloadCsv() {
    const header = [
      'Vendor',
      'SKU',
      'Item',
      'On hand',
      'Min',
      'Order qty',
      'Unit cost',
      'Line total',
    ];
    const lines = rows.map((r) =>
      [
        r.vendor || '',
        r.sku || '',
        r.name,
        String(r.qty_on_hand),
        String(r.min_qty),
        String(r.orderQty),
        (Number(r.cost) || 0).toFixed(2),
        r.lineCost.toFixed(2),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `po-reorder-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyList() {
    const text = byVendor
      .map(([vendor, list]) => {
        const lines = list
          .map(
            (r) =>
              `  ${r.orderQty}× ${r.name}${r.sku ? ` (${r.sku})` : ''} @ $${(Number(r.cost) || 0).toFixed(2)}`
          )
          .join('\n');
        return `${vendor}\n${lines}`;
      })
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setMessage('PO list copied');
    } catch {
      setMessage('Could not copy');
    }
  }

  async function markOrdered(id: string) {
    setPending(id);
    setMessage(null);
    const result = await markInventoryOrdered(id);
    setMessage(result.error || result.success || null);
    setPending(null);
  }

  if (rows.length === 0) {
    return (
      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Reorder / PO list
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Nothing at or below min qty. Set min qty and vendor on items to use
          this list.
        </p>
      </section>
    );
  }

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Reorder / PO list
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {rows.length} item{rows.length === 1 ? '' : 's'} at or below min —
            grouped by vendor
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyList()}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            Copy PO list
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Export PO CSV
          </button>
        </div>
      </div>
      {message && (
        <p className="text-sm text-emerald-700">{message}</p>
      )}
      <div className="space-y-4">
        {byVendor.map(([vendor, list]) => (
          <div key={vendor}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {vendor}
            </p>
            <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {r.orderQty}× {r.name}
                    </p>
                    <p className="text-xs text-ink-500">
                      On hand {r.qty_on_hand} / min {r.min_qty}
                      {r.sku ? ` · ${r.sku}` : ''}
                      {r.reorder_ordered_at
                        ? ` · marked ordered ${new Date(r.reorder_ordered_at).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-600">
                      ${(r.lineCost || 0).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      disabled={pending === r.id}
                      onClick={() => void markOrdered(r.id)}
                      className="rounded-lg border border-ink-200 px-2 py-1 text-xs font-semibold hover:bg-ink-50 disabled:opacity-50"
                    >
                      {pending === r.id ? '…' : 'Mark ordered'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
