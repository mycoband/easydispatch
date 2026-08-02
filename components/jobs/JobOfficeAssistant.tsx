'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { CloseoutGap } from '@/lib/jobs/closeout-gaps';
import { cn } from '@/lib/utils';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'What’s still missing to invoice?',
  'Draft a short customer text about today’s visit',
  'Summarize this job for the owner',
  'What should the office do next?',
];

function officeAnchor(gap: CloseoutGap): string {
  if (gap.id === 'clock_out' || gap.id === 'signature') return 'job-time';
  return 'job-invoice';
}

export function JobOfficeAssistant({
  jobId,
  gaps = [],
  paymentStatus,
}: {
  jobId: string;
  gaps?: CloseoutGap[];
  paymentStatus?: string | null;
}) {
  const paid = paymentStatus === 'Paid';
  const missing = gaps.filter((g) => !g.done);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Ask about this job — draft customer text, check what’s missing to invoice, or get a quick owner summary. I only use data on this ticket.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/job-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          messages: next.slice(-12),
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Assistant failed');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer || 'No answer.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant failed');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function jump(anchor: string) {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            Job assistant
          </p>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Ask about this job
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Draft texts, invoice gaps, owner summary — grounded in this ticket
          </p>
        </div>
        <span className="text-sm font-semibold text-brand-700">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink-100 px-5 pb-5 pt-3">
          {paid ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Ready to collect
              </p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-950">
                Paid — nothing missing
              </p>
            </div>
          ) : missing.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Missing to invoice
              </p>
              <ul className="mt-2 space-y-2">
                {missing.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">
                        {g.label}
                        {g.blocked ? (
                          <span className="ml-2 text-xs font-medium text-amber-800">
                            Blocked
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-600">{g.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => jump(officeAnchor(g))}
                      className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      Fix
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : gaps.length > 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Ready to collect
              </p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-950">
                Closeout checklist complete — collect payment if needed
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => void send(s)}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/40 p-3">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'ml-6 bg-brand-600 text-white'
                    : 'mr-6 bg-white text-ink-800 ring-1 ring-ink-100'
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <p className="text-xs text-ink-400">Thinking…</p>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this job…"
              disabled={loading}
              className="min-w-[200px] flex-1 rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {loading ? '…' : 'Ask'}
            </button>
          </form>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
