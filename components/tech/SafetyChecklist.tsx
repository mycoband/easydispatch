'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSafetyChecklist } from '@/app/tech/actions';
import {
  SAFETY_CHECKLIST_ITEMS,
  type SafetyChecklistState,
} from '@/lib/tech/safety';

export function SafetyChecklist({
  jobId,
  initial,
}: {
  jobId: string;
  initial?: SafetyChecklistState | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<SafetyChecklistState>(initial || {});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: (typeof SAFETY_CHECKLIST_ITEMS)[number]['id']) {
    setState((prev) => {
      const checked = !prev[id]?.checked;
      return {
        ...prev,
        [id]: {
          checked,
          at: checked ? new Date().toISOString() : null,
        },
      };
    });
  }

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveSafetyChecklist(jobId, state);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      router.refresh();
    }
    setPending(false);
  }

  const done = SAFETY_CHECKLIST_ITEMS.filter((i) => state[i.id]?.checked).length;

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Safety / permit checklist
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {done}/{SAFETY_CHECKLIST_ITEMS.length} complete
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {SAFETY_CHECKLIST_ITEMS.map((item) => {
          const checked = Boolean(state[item.id]?.checked);
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 px-3 py-2.5 hover:bg-ink-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  className="mt-1"
                />
                <span className="text-sm text-ink-800">{item.label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save checklist'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
