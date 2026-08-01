'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPricebookItem } from '@/app/dashboard/pricebook/actions';
import { DeletePricebookButton } from '@/components/pricebook/DeletePricebookButton';
import { PricebookForm } from '@/components/pricebook/PricebookForm';
import { formatMoney } from '@/lib/jobs/totals';

export type PricebookItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number | string | null;
  unit_cost?: number | string | null;
  item_type?: string | null;
  taxable: boolean | null;
};

export function PricebookItemRow({ item }: { item: PricebookItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const updateAction = useMemo(
    () => upsertPricebookItem.bind(null, item.id),
    [item.id]
  );

  return (
    <>
      <tr>
        <td className="px-4 py-3">
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-ink-400">{item.description}</p>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">{item.category}</td>
        <td className="hidden px-4 py-3 text-right text-ink-500 lg:table-cell">
          {formatMoney(Number(item.unit_cost) || 0)}
        </td>
        <td className="px-4 py-3 text-right font-medium">
          {formatMoney(Number(item.unit_price) || 0)}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <DeletePricebookButton id={item.id} />
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-ink-50/50 px-4 py-4">
            <p className="mb-3 text-sm font-medium text-ink-700">
              Edit {item.name}
            </p>
            <PricebookForm
              action={updateAction}
              initial={{
                name: item.name,
                description: item.description,
                category: item.category,
                unit_price: item.unit_price,
                unit_cost: item.unit_cost,
                item_type: item.item_type,
                taxable: item.taxable,
              }}
              submitLabel="Save changes"
              onSuccess={() => {
                setEditing(false);
                router.refresh();
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}
