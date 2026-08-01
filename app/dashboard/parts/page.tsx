import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { requireCompanyModule } from '@/lib/company/require-module';
import { EmptyState } from '@/components/ui/EmptyState';
import { PartsBoard } from '@/components/parts/PartsBoard';
import { formatMoney } from '@/lib/jobs/totals';

export default async function PartsBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireCompanyModule('part_orders');
  const { supabase } = await requireOffice();
  const { status } = await searchParams;

  let query = supabase
    .from('job_part_orders')
    .select(
      'id, job_id, description, sku, vendor, qty, unit_cost, status, eta_date, notes, ordered_at, received_at, created_at, jobs(id, job_number, customer_name, status)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['needed', 'ordered', 'received']);
  }

  const { data: orders, error } = await query;

  const { data: inventory } = await supabase
    .from('inventory_items')
    .select('id, name, sku, qty_on_hand')
    .order('name')
    .limit(300);

  const filters = [
    { id: 'open', label: 'Open', href: '/dashboard/parts' },
    { id: 'needed', label: 'Needed', href: '/dashboard/parts?status=needed' },
    { id: 'ordered', label: 'Ordered', href: '/dashboard/parts?status=ordered' },
    {
      id: 'received',
      label: 'Received',
      href: '/dashboard/parts?status=received',
    },
    { id: 'all', label: 'All', href: '/dashboard/parts?status=all' },
  ];

  const active = status || 'open';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Parts board
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Special orders across jobs — order, receive, and stock in one place.
          </p>
        </div>
        <Link
          href="/dashboard/inventory"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Truck inventory
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.id}
            href={f.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active === f.id
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Parts table missing?</p>
          <p className="mt-1">
            Run <code className="font-mono">supabase/competitive-features.sql</code>
          </p>
          <p className="mt-1 text-xs">{error.message}</p>
        </div>
      )}

      {!error && (!orders || orders.length === 0) ? (
        <div className="panel">
          <EmptyState
            title="No open part orders"
            description="Add special-order parts from a job. They show up here for the whole office."
            action={{ href: '/dashboard/jobs', label: 'Open jobs' }}
          />
        </div>
      ) : (
        <PartsBoard
          orders={(orders ?? []).map((o) => {
            const job = Array.isArray(o.jobs) ? o.jobs[0] : o.jobs;
            return {
              id: o.id,
              job_id: o.job_id,
              description: o.description,
              sku: o.sku,
              vendor: o.vendor,
              qty: Number(o.qty) || 1,
              unit_cost: Number(o.unit_cost) || 0,
              status: o.status,
              eta_date: o.eta_date,
              notes: o.notes,
              job_number: job?.job_number ?? null,
              customer_name: job?.customer_name ?? null,
              costLabel: formatMoney(
                (Number(o.qty) || 1) * (Number(o.unit_cost) || 0)
              ),
            };
          })}
          inventory={(inventory ?? []).map((i) => ({
            id: i.id,
            name: i.name,
            sku: i.sku,
            qty_on_hand: Number(i.qty_on_hand) || 0,
          }))}
        />
      )}
    </div>
  );
}
