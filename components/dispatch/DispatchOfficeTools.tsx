'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendBulkOmw,
  sendDayReminders,
} from '@/app/dashboard/messages/actions';

export function DispatchOfficeTools({
  summary,
}: {
  summary: { unassigned: number; enRoute: number; onSite: number };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'reminders' | 'omw') {
    setPending(kind);
    setFlash(null);
    setError(null);
    const result = kind === 'reminders' ? await sendDayReminders() : await sendBulkOmw();
    if (result.error) setError(result.error);
    else setFlash(result.success || 'Done');
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-200 bg-ink-50/80 px-3 py-3 text-sm">
        <span className="mr-1 font-semibold text-ink-600">Office tools:</span>
        <button
          type="button"
          disabled={Boolean(pending)}
          className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
          onClick={() => run('reminders')}
        >
          {pending === 'reminders' ? 'Sending…' : 'Send day reminders'}
        </button>
        <button
          type="button"
          disabled={Boolean(pending)}
          className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          onClick={() => run('omw')}
        >
          {pending === 'omw' ? 'Sending…' : 'On-my-way to all active'}
        </button>
        <Link
          href="/dashboard/invoices"
          className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-amber-800 hover:bg-amber-50"
        >
          Unpaid follow-ups
        </Link>
        <p className="ml-auto text-xs text-ink-400">
          {summary.unassigned} unassigned · {summary.enRoute} en route ·{' '}
          {summary.onSite} on site
        </p>
      </div>
      {flash && <p className="text-sm text-emerald-700">{flash}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
