'use client';

import { useState } from 'react';
import type { TicketFill } from '@/lib/grok';
import { searchCustomers } from '@/app/dashboard/customers/search-actions';
import { DictationField } from '@/components/ui/DictationButton';
import { cn } from '@/lib/utils';

export type TicketAiFillResult = TicketFill & {
  matched_customer_id?: string | null;
  matched_customer_name?: string | null;
};

export function TicketAiFill({
  onFilled,
}: {
  onFilled: (fill: TicketAiFillResult) => void;
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setLastSummary(null);
    try {
      const res = await fetch('/api/ai/ticket-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ticket fill failed');

      const fill = data.fill as TicketFill;
      let matched_customer_id: string | null = null;
      let matched_customer_name: string | null =
        fill.matched_customer_name || null;

      if (fill.matched_customer_name?.trim()) {
        const hits = await searchCustomers(fill.matched_customer_name, 8);
        const needle = fill.matched_customer_name.trim().toLowerCase();
        const exact = hits.find(
          (c) => c.name.trim().toLowerCase() === needle
        );
        const hit =
          exact ||
          hits.find(
            (c) =>
              c.name.trim().toLowerCase().includes(needle) ||
              needle.includes(c.name.trim().toLowerCase())
          );
        if (hit) {
          matched_customer_id = hit.id;
          matched_customer_name = hit.name;
        }
      }

      onFilled({ ...fill, matched_customer_id, matched_customer_name });
      setLastSummary(
        fill.summary ||
          'Filled — review fields below, then Create job.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket fill failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-5 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
          Fastest path
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-950">
          Paste or speak the call notes
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Paste call notes, review, Create — AI fills customer, job type,
          diagnosis, and schedule hints.
        </p>
      </div>

      <DictationField
        value={text}
        onChange={setText}
        rows={4}
        micLabel="Speak call notes"
        disabled={pending}
        placeholder={`Example: Jane Smith at Oak St — no cool since last night, AC blowing warm. Prefers tomorrow morning. Dog in backyard.`}
        className="border-violet-200 outline-none ring-violet-500/25 focus:ring-4"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || text.trim().length < 8}
          onClick={() => void run()}
          className={cn(
            'w-full rounded-xl bg-violet-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-violet-800 disabled:opacity-50 sm:w-auto'
          )}
        >
          {pending ? 'Filling…' : 'Fill ticket with AI'}
        </button>
        {text.trim() && (
          <button
            type="button"
            onClick={() => {
              setText('');
              setError(null);
              setLastSummary(null);
            }}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {lastSummary && !error && (
        <p className="mt-3 rounded-lg bg-white/90 px-3 py-2.5 text-sm font-medium text-violet-950 ring-1 ring-violet-200">
          {lastSummary} Review fields below, then Create job.
        </p>
      )}
    </section>
  );
}
