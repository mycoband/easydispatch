'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  convertEstimateToJob,
  deleteEstimate,
  markEstimateSent,
} from '@/app/dashboard/estimates/actions';

export function EstimateActions({
  estimateId,
  convertedJobId,
  linkedJobId,
  status,
}: {
  estimateId: string;
  convertedJobId: string | null;
  linkedJobId?: string | null;
  status: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyLabel = linkedJobId ? 'Apply to job' : 'Convert to job';

  async function run(kind: 'sent' | 'convert' | 'delete') {
    if (kind === 'delete') {
      if (!confirm('Delete this estimate?')) return;
    }
    if (kind === 'convert' && linkedJobId) {
      if (
        !confirm(
          'Apply this estimate’s line items onto the linked job and mark it approved?'
        )
      ) {
        return;
      }
    }
    setPending(kind);
    setError(null);
    setMessage(null);
    try {
      const result =
        kind === 'sent'
          ? await markEstimateSent(estimateId)
          : kind === 'convert'
            ? await convertEstimateToJob(estimateId)
            : await deleteEstimate(estimateId);
      if (result?.error) setError(result.error);
      else if (result?.success) {
        setMessage(result.success);
        router.refresh();
      }
    } catch {
      // redirect() throws in Next server actions — treat as success navigation
      router.refresh();
    }
    setPending(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== 'Sent' && status !== 'Approved' && (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run('sent')}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
          >
            {pending === 'sent' ? '…' : 'Mark sent'}
          </button>
        )}
        {!convertedJobId && (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run('convert')}
            className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {pending === 'convert' ? 'Working…' : applyLabel}
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => run('delete')}
          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {pending === 'delete' ? '…' : 'Delete'}
        </button>
      </div>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
