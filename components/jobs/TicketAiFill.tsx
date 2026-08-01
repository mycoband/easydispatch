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
      setLastSummary(fill.summary || 'Fields filled — review before saving.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket fill failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            AI ticket fill
          </p>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Paste or speak the call notes
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Grok fills job type, priority, diagnosis, schedule hints, and more —
            you still review before create.
          </p>
        </div>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || text.trim().length < 8}
          onClick={() => void run()}
          className={cn(
            'rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50'
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
        <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-sm text-violet-950 ring-1 ring-violet-200">
          {lastSummary}
        </p>
      )}
    </section>
  );
}
