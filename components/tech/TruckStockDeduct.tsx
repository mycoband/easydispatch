'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deductTruckStock } from '@/app/tech/actions';

type Item = {
  id: string;
  name: string;
  qty_on_hand: number | null;
  location: string | null;
  sku: string | null;
};

export function TruckStockDeduct({
  jobId,
  items,
}: {
  jobId: string;
  items: Item[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const filtered = items.filter((item) => {
    if (!q.trim()) return true;
    const hay = `${item.name} ${item.sku || ''} ${item.location || ''}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function deduct(itemId: string) {
    setPendingId(itemId);
    setError(null);
    setMessage(null);
    const result = await deductTruckStock(jobId, itemId, 1);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Deducted');
      router.refresh();
    }
    setPendingId(null);
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Truck stock — did I use it?
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          One-tap deduct (−1). Adds a costed parts line on the job and refreshes
          P&amp;L when job costing is on.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search parts…"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-400">
          No inventory items yet. Office can add them under Inventory.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {filtered.slice(0, 40).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  {item.name}
                </p>
                <p className="text-xs text-ink-500">
                  Qty {Number(item.qty_on_hand) || 0}
                  {item.location ? ` · ${item.location}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(pendingId)}
                onClick={() => deduct(item.id)}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendingId === item.id ? '…' : '−1 used'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
