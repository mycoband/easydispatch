'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  receivePartIntoInventory,
  advancePartFromBoard,
} from '@/app/dashboard/parts/actions';
import { nextPartOrderStatus } from '@/lib/jobs/part-orders';

type OrderRow = {
  id: string;
  job_id: string;
  description: string;
  sku: string | null;
  vendor: string | null;
  qty: number;
  unit_cost: number;
  status: string;
  eta_date: string | null;
  notes: string | null;
  job_number: string | null;
  customer_name: string | null;
  costLabel: string;
};

type Inv = {
  id: string;
  name: string;
  sku: string | null;
  qty_on_hand: number;
};

export function PartsBoard({
  orders,
  inventory,
}: {
  orders: OrderRow[];
  inventory: Inv[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [receiveFor, setReceiveFor] = useState<string | null>(null);

  function advance(jobId: string, orderId: string, status: string) {
    const next = nextPartOrderStatus(status as never);
    if (!next) return;
    setMessage(null);
    startTransition(async () => {
      const res = await advancePartFromBoard(jobId, orderId, next);
      setMessage(res.error || res.success || null);
      router.refresh();
    });
  }

  function stockIn(
    jobId: string,
    orderId: string,
    form: FormData
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await receivePartIntoInventory(jobId, orderId, {
        inventoryItemId: String(form.get('inventory_item_id') || ''),
        createName: String(form.get('create_name') || ''),
        sku: String(form.get('sku') || ''),
        qty: Number(form.get('qty') || 0),
        cost: Number(form.get('cost') || 0),
        location: String(form.get('location') || ''),
      });
      setMessage(res.error || res.success || null);
      setReceiveFor(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.toLowerCase().includes('fail') ||
            message.toLowerCase().includes('required') ||
            message.toLowerCase().includes('not')
              ? 'bg-red-50 text-red-700'
              : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Part</th>
              <th className="hidden px-4 py-3 md:table-cell">Job</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 text-right lg:table-cell">Cost</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {orders.map((o) => {
              const next = nextPartOrderStatus(o.status as never);
              return (
                <tr key={o.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{o.description}</p>
                    <p className="text-xs text-ink-400">
                      {[o.vendor, o.sku, o.eta_date ? `ETA ${o.eta_date}` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                    <p className="text-xs text-ink-500 md:hidden">
                      {o.customer_name || 'Job'}{' '}
                      {o.job_number ? `· #${o.job_number}` : ''}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Link
                      href={`/dashboard/jobs/${o.job_id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {o.customer_name || 'Job'}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {o.job_number ? `#${o.job_number}` : o.job_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold capitalize text-ink-700">
                      {o.status}
                    </span>
                    <p className="mt-1 text-xs text-ink-400">Qty {o.qty}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    {o.costLabel}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {next && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => advance(o.job_id, o.id, o.status)}
                          className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                        >
                          Mark {next}
                        </button>
                      )}
                      {(o.status === 'ordered' || o.status === 'received') && (
                        <button
                          type="button"
                          onClick={() =>
                            setReceiveFor(receiveFor === o.id ? null : o.id)
                          }
                          className="text-xs font-semibold text-ink-700 hover:underline"
                        >
                          {receiveFor === o.id ? 'Cancel' : 'Add to stock'}
                        </button>
                      )}
                      <Link
                        href={`/dashboard/jobs/${o.job_id}`}
                        className="text-xs text-ink-500 hover:underline"
                      >
                        Open job
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {receiveFor &&
        (() => {
          const o = orders.find((x) => x.id === receiveFor);
          if (!o) return null;
          return (
            <form
              className="panel space-y-3 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                stockIn(o.job_id, o.id, new FormData(e.currentTarget));
              }}
            >
              <h2 className="font-semibold text-ink-900">
                Receive into inventory — {o.description}
              </h2>
              <p className="text-sm text-ink-500">
                Increases truck stock and marks the part received (if not
                already).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Existing stock item
                  </span>
                  <select
                    name="inventory_item_id"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="">— Create new from this part —</option>
                    {inventory.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.sku ? ` (${i.sku})` : ''} · on hand {i.qty_on_hand}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    New item name
                  </span>
                  <input
                    name="create_name"
                    defaultValue={o.description}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">SKU</span>
                  <input
                    name="sku"
                    defaultValue={o.sku || ''}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Qty</span>
                  <input
                    name="qty"
                    type="number"
                    step="1"
                    min="1"
                    defaultValue={o.qty}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    Unit cost
                  </span>
                  <input
                    name="cost"
                    type="number"
                    step="0.01"
                    defaultValue={o.unit_cost}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Location
                  </span>
                  <input
                    name="location"
                    defaultValue="Warehouse"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Receive into stock'}
              </button>
            </form>
          );
        })()}
    </div>
  );
}
