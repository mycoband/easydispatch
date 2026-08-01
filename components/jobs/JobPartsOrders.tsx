'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createPartOrder,
  deletePartOrder,
  updatePartOrderStatus,
} from '@/app/dashboard/jobs/parts-actions';
import {
  nextPartOrderStatus,
  type PartOrderStatus,
} from '@/lib/jobs/part-orders';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/jobs/totals';

export type PartOrder = {
  id: string;
  description: string;
  sku: string | null;
  vendor: string | null;
  qty: number | string | null;
  unit_cost: number | string | null;
  status: string;
  eta_date: string | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  needed: 'bg-amber-50 text-amber-900 ring-amber-200',
  ordered: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  received: 'bg-sky-50 text-sky-800 ring-sky-200',
  installed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-ink-100 text-ink-600 ring-ink-200',
};

const STATUS_LABEL: Record<string, string> = {
  needed: 'Needed',
  ordered: 'Ordered',
  received: 'Received',
  installed: 'Installed',
  cancelled: 'Cancelled',
};

const NEXT_LABEL: Record<PartOrderStatus, string> = {
  needed: 'Mark ordered',
  ordered: 'Mark received',
  received: 'Mark installed',
  installed: 'Installed',
  cancelled: 'Cancelled',
};

const emptyForm = {
  description: '',
  sku: '',
  vendor: '',
  qty: '1',
  unit_cost: '0',
  eta_date: '',
  notes: '',
};

export function JobPartsOrders({
  jobId,
  orders,
}: {
  jobId: string;
  orders: PartOrder[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(orders.length === 0);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      setError('Description required');
      return;
    }
    setPending('add');
    setError(null);
    setMessage(null);
    const result = await createPartOrder(jobId, {
      description: form.description,
      sku: form.sku,
      vendor: form.vendor,
      qty: Number(form.qty) || 1,
      unit_cost: Number(form.unit_cost) || 0,
      eta_date: form.eta_date || undefined,
      notes: form.notes,
    });
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Added');
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    }
    setPending(null);
  }

  async function advance(orderId: string, status: string) {
    const next = nextPartOrderStatus(status);
    if (!next) return;
    setPending(orderId);
    setError(null);
    const result = await updatePartOrderStatus(jobId, orderId, next);
    if (result.error) setError(result.error);
    else router.refresh();
    setPending(null);
  }

  async function cancelOrder(orderId: string) {
    setPending(orderId);
    setError(null);
    const result = await updatePartOrderStatus(jobId, orderId, 'cancelled');
    if (result.error) setError(result.error);
    else router.refresh();
    setPending(null);
  }

  async function remove(orderId: string) {
    if (!confirm('Remove this part order?')) return;
    setPending(orderId);
    setError(null);
    const result = await deletePartOrder(jobId, orderId);
    if (result.error) setError(result.error);
    else router.refresh();
    setPending(null);
  }

  const openCount = orders.filter(
    (o) => o.status !== 'installed' && o.status !== 'cancelled'
  ).length;

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Special-order parts
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {orders.length === 0
              ? 'Track backordered or special-order parts for this job.'
              : `${openCount} open · ${orders.length} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50"
        >
          {showForm ? 'Cancel' : '+ Add part'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-3 sm:grid-cols-2"
        >
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Description
            </span>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. Compressor, 3-ton R410A"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              SKU / part #
            </span>
            <input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Vendor
            </span>
            <input
              value={form.vendor}
              onChange={(e) =>
                setForm((f) => ({ ...f, vendor: e.target.value }))
              }
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Qty
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Unit cost
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) =>
                setForm((f) => ({ ...f, unit_cost: e.target.value }))
              }
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              ETA
            </span>
            <input
              type="date"
              value={form.eta_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, eta_date: e.target.value }))
              }
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm sm:w-48"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Notes
            </span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending === 'add'}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:col-span-2"
          >
            {pending === 'add' ? 'Adding…' : 'Add part order'}
          </button>
        </form>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-ink-400">No part orders on this job.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const next = nextPartOrderStatus(o.status);
            const canCancel =
              o.status !== 'installed' && o.status !== 'cancelled';
            return (
              <li
                key={o.id}
                className="rounded-xl border border-ink-100 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">
                        {o.description}
                      </p>
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                          STATUS_STYLES[o.status] ||
                            'bg-ink-50 text-ink-700 ring-ink-200'
                        )}
                      >
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {[
                        o.sku && `SKU ${o.sku}`,
                        o.vendor,
                        `Qty ${Number(o.qty) || 1}`,
                        `${formatMoney(Number(o.unit_cost) || 0)} ea`,
                        o.eta_date && `ETA ${o.eta_date}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {o.notes && (
                      <p className="mt-1 text-xs text-ink-500">{o.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {next && (
                      <button
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => advance(o.id, o.status)}
                        className="rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {pending === o.id ? '…' : NEXT_LABEL[o.status as PartOrderStatus]}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => cancelOrder(o.id)}
                        className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => remove(o.id)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
