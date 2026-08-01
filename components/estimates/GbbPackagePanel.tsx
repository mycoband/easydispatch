'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { approveGbbOption } from '@/app/dashboard/estimates/gbb-actions';
import { formatMoney } from '@/lib/jobs/totals';
import { cn } from '@/lib/utils';

type SiblingOption = {
  id: string;
  option_label: string | null;
  option_headline: string | null;
  status: string | null;
  total: number | string | null;
  is_recommended: boolean | null;
};

export function GbbPackagePanel({
  currentEstimateId,
  siblings,
}: {
  currentEstimateId: string;
  siblings: SiblingOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(id: string) {
    setPending(id);
    setError(null);
    const result = await approveGbbOption(id);
    if (result.error) setError(result.error);
    else router.refresh();
    setPending(null);
  }

  return (
    <section className="panel space-y-3 border-brand-200/60 p-5 ring-1 ring-brand-100">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Good / Better / Best package
        </p>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Package options
        </h2>
      </div>
      <ul className="space-y-2">
        {siblings.map((s) => {
          const isCurrent = s.id === currentEstimateId;
          return (
            <li
              key={s.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3',
                isCurrent ? 'border-brand-300 bg-brand-50/50' : 'border-ink-100'
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">
                  {s.option_label}
                  {s.is_recommended ? ' ★' : ''}
                  {isCurrent && (
                    <span className="ml-1 text-xs font-normal text-ink-400">
                      (this estimate)
                    </span>
                  )}
                </p>
                {s.option_headline && (
                  <p className="text-xs text-ink-500">{s.option_headline}</p>
                )}
                <p className="text-xs text-ink-500">
                  {formatMoney(Number(s.total) || 0)} · {s.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isCurrent && (
                  <Link
                    href={`/dashboard/estimates/${s.id}`}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    Open
                  </Link>
                )}
                {s.status !== 'Approved' && (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => approve(s.id)}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {pending === s.id ? '…' : 'Approve'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
