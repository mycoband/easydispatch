'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRolePermissions } from '@/app/dashboard/settings/permission-actions';
import {
  OFFICE_PERMISSIONS,
  OFFICE_PERMISSION_GROUPS,
  TECH_PERMISSIONS,
  TECH_PERMISSION_GROUPS,
  techPreset,
  type OfficePermissionId,
  type RolePermissions,
  type TechPermissionId,
} from '@/lib/company/permissions';

type Tab = 'technician' | 'dispatcher' | 'office';

export function RolePermissionsEditor({
  initial,
}: {
  initial: RolePermissions;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('technician');
  const [perms, setPerms] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const techGroups = useMemo(
    () =>
      TECH_PERMISSION_GROUPS.map((group) => ({
        group,
        items: TECH_PERMISSIONS.filter((p) => p.group === group),
      })),
    []
  );

  const officeGroups = useMemo(
    () =>
      OFFICE_PERMISSION_GROUPS.map((group) => ({
        group,
        items: OFFICE_PERMISSIONS.filter((p) => p.group === group),
      })),
    []
  );

  function toggleTech(id: TechPermissionId) {
    setPerms((prev) => ({
      ...prev,
      technician: { ...prev.technician, [id]: !prev.technician[id] },
    }));
  }

  function toggleOffice(role: 'dispatcher' | 'office', id: OfficePermissionId) {
    setPerms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [id]: !prev[role][id] },
    }));
  }

  async function save() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveRolePermissions(perms);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      router.refresh();
    }
    setPending(false);
  }

  const tabs: { id: Tab; label: string; blurb: string }[] = [
    {
      id: 'technician',
      label: 'Technicians',
      blurb: 'Field app — what techs can do on assigned jobs',
    },
    {
      id: 'dispatcher',
      label: 'Dispatchers',
      blurb: 'Office app — scheduling leads and managers',
    },
    {
      id: 'office',
      label: 'Office staff',
      blurb: 'Office app — clerks without full admin rights',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-500">
          Owners (CEO) always have full access, including billing. Use these
          toggles to lock down technicians and limit what office roles can
          change.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === t.id
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-500">
        {tabs.find((t) => t.id === tab)?.blurb}
      </p>

      {tab === 'technician' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setPerms((p) => ({ ...p, technician: techPreset('full') }))
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Full field + pricing
          </button>
          <button
            type="button"
            onClick={() =>
              setPerms((p) => ({ ...p, technician: techPreset('field_only') }))
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Field only (no money)
          </button>
          <button
            type="button"
            onClick={() =>
              setPerms((p) => ({ ...p, technician: techPreset('minimal') }))
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Minimal
          </button>
        </div>
      )}

      {tab === 'technician' &&
        techGroups.map(({ group, items }) => (
          <section key={group} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {group}
            </h3>
            <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-ink-500">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={perms.technician[item.id]}
                    onClick={() => toggleTech(item.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      perms.technician[item.id] ? 'bg-brand-600' : 'bg-ink-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        perms.technician[item.id] ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {(tab === 'dispatcher' || tab === 'office') &&
        officeGroups.map(({ group, items }) => (
          <section key={group} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {group}
            </h3>
            <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-ink-500">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={perms[tab][item.id]}
                    onClick={() => toggleOffice(tab, item.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      perms[tab][item.id] ? 'bg-brand-600' : 'bg-ink-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        perms[tab][item.id] ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <div className="rounded-lg border border-ink-100 bg-ink-50/60 px-4 py-3 text-sm text-ink-600">
        <p className="font-medium text-ink-800">Owner / CEO</p>
        <p className="mt-0.5 text-xs text-ink-500">
          Always has every permission, including billing. Not configurable.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save permissions'}
      </button>
    </div>
  );
}
