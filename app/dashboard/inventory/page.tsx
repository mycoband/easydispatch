import Link from 'next/link';
import {
  deductInventory,
  deleteInventoryItem,
  upsertInventoryItem,
} from '@/app/dashboard/inventory/actions';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { InventoryRowActions } from '@/components/inventory/InventoryRowActions';
import { ReorderPanel } from '@/components/inventory/ReorderPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { requireCompanyModule } from '@/lib/company/require-module';
import { formatMoney } from '@/lib/jobs/totals';

export default async function InventoryPage() {
  await requireCompanyModule('inventory');

  const [{ supabase }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const showPo = Boolean(company.modules.inventory_po);

  const { data: items, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name');

  const low = (items ?? []).filter(
    (i) => Number(i.qty_on_hand) <= Number(i.min_qty)
  );

  const createAction = upsertInventoryItem.bind(null, null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Truck inventory
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Parts on trucks / warehouse · {low.length} at or below min
          </p>
        </div>
        <Link
          href="/dashboard/parts"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Parts board
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {low.length > 0 && !showPo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Low stock</p>
          <p className="mt-1">
            {low.map((i) => `${i.name} (${i.qty_on_hand})`).join(' · ')}
          </p>
        </div>
      )}

      {showPo && (
        <ReorderPanel
          items={low.map((i) => ({
            id: i.id,
            name: i.name,
            sku: i.sku,
            qty_on_hand: Number(i.qty_on_hand) || 0,
            min_qty: Number(i.min_qty) || 0,
            reorder_qty:
              (i as { reorder_qty?: number | null }).reorder_qty ?? null,
            vendor: (i as { vendor?: string | null }).vendor ?? null,
            cost: Number(i.cost) || 0,
            reorder_ordered_at:
              (i as { reorder_ordered_at?: string | null })
                .reorder_ordered_at ?? null,
          }))}
        />
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="hidden px-4 py-3 text-right md:table-cell">
                Sell
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {(items ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <EmptyState
                    title="No inventory items yet"
                    description="Add truck stock below, or receive special-order parts into inventory from the parts board."
                    action={{ href: '/dashboard/parts', label: 'Parts board' }}
                  />
                </td>
              </tr>
            ) : (
              (items ?? []).map((item) => {
                const isLow =
                  Number(item.qty_on_hand) <= Number(item.min_qty);
                return (
                  <tr
                    key={item.id}
                    className={isLow ? 'bg-amber-50/50' : undefined}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-ink-400">
                        {item.sku || 'No SKU'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {item.location || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(item.qty_on_hand)}
                      <span className="text-xs text-ink-400">
                        {' '}
                        / min {Number(item.min_qty)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      {formatMoney(Number(item.sell_price) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InventoryRowActions
                        id={item.id}
                        onDeduct={deductInventory}
                        onDelete={deleteInventoryItem}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Add part</h2>
        <InventoryForm action={createAction} />
      </section>
    </div>
  );
}
