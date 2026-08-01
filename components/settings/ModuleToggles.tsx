'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCompanyModules } from '@/app/dashboard/settings/module-actions';
import {
  COMPANY_MODULES,
  MODULE_GROUPS,
  type ModuleId,
} from '@/lib/company/modules';

export function ModuleToggles({
  initial,
}: {
  initial: Record<ModuleId, boolean>;
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return MODULE_GROUPS.map((group) => ({
      group,
      items: COMPANY_MODULES.filter((m) => m.group === group),
    })).filter((g) => g.items.length > 0);
  }, []);

  const enabledCount = COMPANY_MODULES.filter((m) => modules[m.id]).length;

  function toggle(id: ModuleId) {
    setModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function enableAll() {
    const next = { ...modules };
    for (const m of COMPANY_MODULES) next[m.id] = true;
    setModules(next);
  }

  function essentialsOnly() {
    const next = { ...modules };
    for (const m of COMPANY_MODULES) next[m.id] = false;
    // Lean service-shop starter set
    next.dispatch = true;
    next.dispatch_realtime = true;
    next.calendar = true;
    next.invoices = true;
    next.messaging = true;
    next.tech_media = true;
    next.tech_offline_queue = true;
    next.ai = true;
    next.ai_walkthrough = true;
    next.print_pdfs = true;
    setModules(next);
  }

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveCompanyModules(modules);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Modules saved');
      router.refresh();
    }
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">
            Every optional EasyDispatch feature is listed here. Off hides its
            nav, pages, and related buttons. Core customers + jobs stay on.
            Full how-to for each toggle is in Help / FAQ (search the module
            name).
          </p>
          <p className="mt-1 text-xs font-medium text-ink-400">
            {enabledCount} / {COMPANY_MODULES.length} modules enabled
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enableAll}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={essentialsOnly}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Essentials only
          </button>
        </div>
      </div>

      {grouped.map(({ group, items }) => (
        <div key={group}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {group}
          </h3>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
            {items.map((mod) => {
              const on = modules[mod.id];
              return (
                <li
                  key={mod.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">{mod.label}</p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {mod.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(mod.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      on ? 'bg-brand-600' : 'bg-ink-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        on ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save modules'}
      </button>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
