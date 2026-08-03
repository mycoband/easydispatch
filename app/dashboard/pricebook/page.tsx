import Link from 'next/link';
import { upsertPricebookItem } from '@/app/dashboard/pricebook/actions';
import { PricebookForm } from '@/components/pricebook/PricebookForm';
import { PricebookItemRow } from '@/components/pricebook/PricebookItemRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireOffice } from '@/lib/auth';
import { requireCompanyModuleAndPermission } from '@/lib/company/require-module';

export default async function PricebookPage() {
  await requireCompanyModuleAndPermission('pricebook', 'manage_pricebook');

  const { supabase } = await requireOffice();
  const { data: items, error } = await supabase
    .from('pricebook_items')
    .select('*')
    .order('sort_order')
    .order('name');

  const createAction = upsertPricebookItem.bind(null, null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Pricebook
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Flat rates for estimates and jobs — edit once, reuse everywhere.
          </p>
        </div>
        <Link
          href="/dashboard/pricebook/import"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Import CSV
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Pricebook unavailable</p>
          <p className="mt-1">
            Refresh and try again. If this keeps happening, contact support.
          </p>
          <p className="mt-1 text-xs">{error.message}</p>
        </div>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="hidden px-4 py-3 md:table-cell">Category</th>
              <th className="hidden px-4 py-3 text-right lg:table-cell">Cost</th>
              <th className="px-4 py-3 text-right">Sell</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {(items ?? []).map((item) => (
              <PricebookItemRow
                key={item.id}
                item={{
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  category: item.category,
                  unit_price: item.unit_price,
                  unit_cost: item.unit_cost,
                  item_type: item.item_type,
                  taxable: item.taxable,
                }}
              />
            ))}
            {!items?.length && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <EmptyState
                    title="No rates yet"
                    description="Add a flat rate below, or import your existing pricebook from CSV."
                    action={{
                      href: '/dashboard/pricebook/import',
                      label: 'Import CSV',
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Add rate</h2>
        <PricebookForm action={createAction} />
      </section>
    </div>
  );
}
