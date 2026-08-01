'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveTechJobNotes } from '@/app/tech/actions';
import { DictationField } from '@/components/ui/DictationButton';

export function TechJobNotes({
  jobId,
  diagnosis,
  customerSummary,
  internalNotes,
}: {
  jobId: string;
  diagnosis?: string | null;
  customerSummary?: string | null;
  internalNotes?: string | null;
}) {
  const router = useRouter();
  const [diag, setDiag] = useState(diagnosis || '');
  const [summary, setSummary] = useState(customerSummary || '');
  const [internal, setInternal] = useState(internalNotes || '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveTechJobNotes(jobId, {
      diagnosis: diag,
      customer_summary: summary,
      internal_notes: internal,
    });
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      router.refresh();
    }
    setPending(false);
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Diagnosis & notes
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Type or speak — save before clock-out
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">
          Diagnosis / findings
        </span>
        <DictationField
          value={diag}
          onChange={setDiag}
          rows={3}
          micLabel="Speak diagnosis"
          disabled={pending}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">
          Customer summary
          <span className="ml-2 font-normal text-ink-400">portal / invoice</span>
        </span>
        <DictationField
          value={summary}
          onChange={setSummary}
          rows={2}
          micLabel="Speak summary"
          disabled={pending}
          className="border-emerald-200 bg-emerald-50/30"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">
          Internal notes
        </span>
        <DictationField
          value={internal}
          onChange={setInternal}
          rows={2}
          micLabel="Speak notes"
          disabled={pending}
          className="border-amber-200 bg-amber-50/40"
        />
      </label>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save notes'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
