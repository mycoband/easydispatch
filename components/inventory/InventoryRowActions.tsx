'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/app/dashboard/inventory/actions';

export function InventoryRowActions({
  id,
  onDeduct,
  onDelete,
}: {
  id: string;
  onDeduct: (id: string, qty: number) => Promise<ActionState>;
  onDelete: (id: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <div className="flex justify-end gap-1">
        <button
          type="button"
          className="rounded-lg border border-ink-200 px-2 py-1 text-xs"
          onClick={async () => {
            const result = await onDeduct(id, 1);
            setMsg(result.error || result.success || null);
            router.refresh();
          }}
        >
          −1 used
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
          onClick={async () => {
            if (!confirm('Delete item?')) return;
            await onDelete(id);
            router.refresh();
          }}
        >
          Delete
        </button>
      </div>
      {msg && <p className="text-[10px] text-ink-500">{msg}</p>}
    </div>
  );
}
