'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/app/dashboard/agreements/actions';

export function AgreementRowActions({
  id,
  showPm,
  showMembership,
  createPm,
  markBilled,
  createInvoiceJob,
  onDelete,
}: {
  id: string;
  showPm: boolean;
  showMembership?: boolean;
  createPm: (id: string) => Promise<ActionState>;
  markBilled?: (id: string) => Promise<ActionState>;
  createInvoiceJob?: (id: string) => Promise<ActionState>;
  onDelete: (id: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'pm' | 'billed' | 'invoice-job' | 'delete') {
    if (kind === 'delete' && !confirm('Delete this agreement?')) return;
    setPending(kind);
    setError(null);
    const result =
      kind === 'pm'
        ? await createPm(id)
        : kind === 'billed'
          ? await markBilled?.(id)
          : kind === 'invoice-job'
            ? await createInvoiceJob?.(id)
            : await onDelete(id);
    if (result?.error) setError(result.error);
    else router.refresh();
    setPending(null);
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-end gap-1">
        {showPm && (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run('pm')}
            className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending === 'pm' ? '…' : 'Create PM job'}
          </button>
        )}
        {showMembership && (
          <>
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => run('billed')}
              className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {pending === 'billed' ? '…' : 'Mark billed'}
            </button>
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => run('invoice-job')}
              className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending === 'invoice-job' ? '…' : 'Create billing job'}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => run('delete')}
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
