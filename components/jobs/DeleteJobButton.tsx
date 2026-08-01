'use client';

import { useState } from 'react';
import { deleteJob } from '@/app/dashboard/jobs/actions';

export function DeleteJobButton({ jobId }: { jobId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm('Delete this job and its line items?')) return;
    setPending(true);
    setError(null);
    const result = await deleteJob(jobId);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? 'Deleting…' : 'Delete job'}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
