'use client';

import { FormEvent, useState } from 'react';

export function AskReports({ from, to }: { from: string; to: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/ask-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, from, to }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAnswer(data.answer || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Ask Reports (AI)
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Ask about profit, techs, job types, or losers in this date range.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Which techs made money? Worst jobs?"
          className="min-w-[220px] flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </form>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {answer && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm leading-relaxed text-ink-800 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </section>
  );
}
