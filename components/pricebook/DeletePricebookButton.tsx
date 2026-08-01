'use client';

import { useRouter } from 'next/navigation';
import { deletePricebookItem } from '@/app/dashboard/pricebook/actions';

export function DeletePricebookButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs text-red-700 hover:underline"
      onClick={async () => {
        if (!confirm('Delete this rate?')) return;
        await deletePricebookItem(id);
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
