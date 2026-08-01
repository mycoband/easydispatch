'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveEquipmentPmChecklist,
  uploadPmChecklistPhoto,
} from '@/app/dashboard/customers/actions';
import {
  DEFAULT_PM_ITEMS,
  countPmDone,
  newCustomPmItemId,
  normalizePmChecklist,
  type PmChecklistDoc,
} from '@/lib/equipment/pm-checklist';
import { cn } from '@/lib/utils';

/**
 * Editable PM checklist with per-item photos.
 * Photos on a job also land in Job photos (tag: pm).
 */
export function PmChecklistPanel({
  customerId,
  equipmentId,
  jobId,
  rawChecklist,
  unitLabel,
  compact = false,
}: {
  customerId: string;
  equipmentId: string;
  jobId?: string | null;
  rawChecklist?: unknown;
  unitLabel?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [doc, setDoc] = useState<PmChecklistDoc>(() =>
    normalizePmChecklist(rawChecklist)
  );
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState(doc.items);
  const [newLabel, setNewLabel] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const next = normalizePmChecklist(rawChecklist);
    setDoc(next);
    if (!editing) setDraftItems(next.items);
  }, [rawChecklist, equipmentId, editing]);

  async function persist(next: PmChecklistDoc, okMsg?: string) {
    setPending('save');
    setMsg(null);
    const result = await saveEquipmentPmChecklist(
      customerId,
      equipmentId,
      next,
      jobId
    );
    setMsg(result.error || okMsg || result.success || null);
    setPending(null);
    if (!result.error) {
      setDoc(next);
      router.refresh();
    }
    return !result.error;
  }

  async function toggle(id: string) {
    const next: PmChecklistDoc = {
      ...doc,
      checks: {
        ...doc.checks,
        [id]: {
          ...doc.checks[id],
          checked: !doc.checks[id]?.checked,
          at: new Date().toISOString(),
          photos: doc.checks[id]?.photos || [],
        },
      },
    };
    setDoc(next);
    await persist(next);
  }

  async function saveItems() {
    const cleaned = draftItems
      .map((i) => ({ id: i.id, label: i.label.trim() }))
      .filter((i) => i.label);
    if (!cleaned.length) {
      setMsg('Add at least one item');
      return;
    }
    const checks = { ...doc.checks };
    for (const item of cleaned) {
      if (!checks[item.id]) {
        checks[item.id] = { checked: false, at: null, photos: [] };
      }
    }
    const next: PmChecklistDoc = {
      version: 2,
      items: cleaned,
      checks,
    };
    const ok = await persist(next, 'Checklist items saved');
    if (ok) {
      setEditing(false);
      setDraftItems(cleaned);
    }
  }

  function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    setDraftItems((prev) => [
      ...prev,
      { id: newCustomPmItemId(), label },
    ]);
    setNewLabel('');
  }

  function removeDraft(id: string) {
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  }

  function resetDefaults() {
    setDraftItems(DEFAULT_PM_ITEMS.map((i) => ({ ...i })));
  }

  async function onPhoto(itemId: string, file: File | null) {
    if (!file) return;
    setPending(`photo-${itemId}`);
    setMsg(null);
    const fd = new FormData();
    fd.set('file', file);
    if (jobId) fd.set('job_id', jobId);
    const result = await uploadPmChecklistPhoto(
      customerId,
      equipmentId,
      itemId,
      fd
    );
    setMsg(result.error || result.success || null);
    setPending(null);
    if (!result.error) router.refresh();
  }

  const done = countPmDone(doc);

  return (
    <div className={cn('space-y-3', !compact && '')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {!compact && (
            <h3 className="font-display text-base font-semibold text-ink-950">
              PM checklist
            </h3>
          )}
          <p className="text-xs text-ink-500">
            {unitLabel ? `${unitLabel} · ` : ''}
            {done}/{doc.items.length} done
            {pending === 'save' ? ' · saving…' : ''}
            {jobId
              ? ' · item photos also go to Job photos'
              : ' · add photos from a job to also file under Job photos'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (editing) {
              setDraftItems(doc.items);
              setEditing(false);
            } else {
              setDraftItems(doc.items);
              setEditing(true);
            }
          }}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-800 hover:bg-ink-50"
        >
          {editing ? 'Cancel edit' : 'Edit items'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-xl border border-ink-200 bg-white p-3">
          <p className="text-xs text-ink-500">
            Add or remove checklist items for this unit. Checked state and
            photos stay on items you keep.
          </p>
          <ul className="space-y-2">
            {draftItems.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  value={item.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setDraftItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, label } : row
                      )
                    );
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeDraft(item.id)}
                  className="shrink-0 text-xs font-semibold text-red-700 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="New item label…"
              className="min-w-[12rem] flex-1 rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold hover:bg-ink-50"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold hover:bg-ink-50"
            >
              Reset defaults
            </button>
            <button
              type="button"
              disabled={pending === 'save'}
              onClick={() => void saveItems()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Save items
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
          {doc.items.map((item) => {
            const row = doc.checks[item.id];
            const checked = Boolean(row?.checked);
            const photos = row?.photos || [];
            const photoPending = pending === `photo-${item.id}`;
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-sm',
                  checked
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-ink-100 bg-white'
                )}
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => void toggle(item.id)}
                    className="mt-0.5"
                  />
                  <span
                    className={cn(
                      'flex-1',
                      checked && 'text-ink-500 line-through'
                    )}
                  >
                    {item.label}
                  </span>
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                  <input
                    ref={(el) => {
                      fileRefs.current[item.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void onPhoto(item.id, f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => fileRefs.current[item.id]?.click()}
                    className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {photoPending ? 'Uploading…' : 'Add photo'}
                  </button>
                  {photos.map((p, i) => (
                    <a
                      key={`${p.url}-${i}`}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-10 w-10 overflow-hidden rounded border border-ink-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <p
          className={cn(
            'text-sm',
            /sql|error|fail|column|required/i.test(msg)
              ? 'text-red-700'
              : 'text-emerald-700'
          )}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
