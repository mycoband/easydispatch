'use client';

import { useState } from 'react';
import { createPortalLink } from '@/app/dashboard/portal/actions';

export function CreatePortalLinkButton({
  purpose,
  customerId,
  estimateId,
  jobId,
  label,
}: {
  purpose: 'estimate' | 'invoice' | 'customer';
  customerId: string | null;
  estimateId?: string | null;
  jobId?: string | null;
  label: string;
}) {
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await createPortalLink({
            purpose,
            customerId,
            estimateId,
            jobId,
          });
          if (result.error) setError(result.error);
          else if (result.url) {
            setUrl(result.url);
            try {
              await navigator.clipboard.writeText(result.url);
            } catch {
              /* ignore */
            }
          }
          setPending(false);
        }}
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
      >
        {pending ? 'Creating…' : label}
      </button>
      {url && (
        <p className="break-all text-xs text-emerald-700">
          Copied: {url}
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
