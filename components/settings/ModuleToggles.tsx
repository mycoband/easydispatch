'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCompanyModules } from '@/app/dashboard/settings/module-actions';
import {
  COMPANY_MODULES,
  MODULE_GROUPS,
  type ModuleId,
} from '@/lib/company/modules';
import {
  SHOP_PRESETS,
  modulesForPreset,
  type ShopPresetId,
} from '@/lib/company/module-presets';

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
  const [lastPreset, setLastPreset] = useState<ShopPresetId | null>(null);

  const grouped = useMemo(() => {
    return MODULE_GROUPS.map((group) => ({
      group,
      items: COMPANY_MODULES.filter((m) => m.group === group),
    })).filter((g) => g.items.length > 0);
  }, []);

  const enabledCount = COMPANY_MODULES.filter((m) => modules[m.id]).length;

  function toggle(id: ModuleId) {
    setLastPreset(null);
    setModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function applyPreset(id: ShopPresetId) {
    setLastPreset(id);
    setModules(modulesForPreset(id));
    setMessage(null);
    setError(null);
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

      <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4">
        <p className="text-sm font-semibold text-ink-900">Shop presets</p>
        <p className="mt-0.5 text-xs text-ink-500">
          Presets set the toggles below — click Save modules to apply.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SHOP_PRESETS.map((preset) => {
            const active = lastPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                onClick={() => applyPreset(preset.id)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? 'border-brand-500 bg-white ring-2 ring-brand-500/30'
                    : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">
                  {preset.label}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {preset.description}
                </span>
              </button>
            );
          })}
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
