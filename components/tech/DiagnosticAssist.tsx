'use client';

import { useState } from 'react';
import { DictationField } from '@/components/ui/DictationButton';

type Assist = {
  likely_causes: string[];
  checks: string[];
  parts_to_bring: string[];
  safety_notes: string[];
  summary?: string | null;
};

export function DiagnosticAssist({
  initialSymptoms,
  equipmentType,
  manufacturer,
  model,
  jobType,
}: {
  initialSymptoms?: string;
  equipmentType?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  jobType?: string | null;
}) {
  const [symptoms, setSymptoms] = useState(initialSymptoms || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assist, setAssist] = useState<Assist | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms,
          equipmentType,
          manufacturer,
          model,
          jobType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assist failed');
      setAssist(data.assist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assist failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          AI diagnostic assist
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Type or speak symptoms → likely causes & parts
        </p>
      </div>

      <DictationField
        value={symptoms}
        onChange={setSymptoms}
        rows={3}
        micLabel="Speak symptoms"
        disabled={pending}
        placeholder="No cool, unit short-cycles, odd noise from condenser…"
      />
      <button
        type="button"
        disabled={pending || symptoms.trim().length < 3}
        onClick={run}
        className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Thinking…' : 'Get likely causes'}
      </button>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {assist && (
        <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 text-sm">
          {assist.summary && (
            <p className="font-medium text-ink-900">{assist.summary}</p>
          )}
          <List title="Likely causes" items={assist.likely_causes} />
          <List title="Checks" items={assist.checks} />
          <List title="Parts to bring" items={assist.parts_to_bring} />
          <List title="Safety" items={assist.safety_notes} />
        </div>
      )}
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
