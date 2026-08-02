'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyPickTicketLines,
  deletePickTicketAttachment,
  uploadPickTicketAttachment,
} from '@/app/dashboard/jobs/parts-actions';
import type { PickTicketExtraction, PickTicketLine } from '@/lib/grok';
import { cn } from '@/lib/utils';

export type PickTicketAttachment = {
  id: string;
  url: string | null;
  caption: string | null;
  created_at: string;
  extract_json?: PickTicketExtraction | null;
};

type EditableLine = {
  key: string;
  description: string;
  sku: string;
  qty: string;
  unit_cost: string;
};

function linesFromExtract(extract: PickTicketExtraction): EditableLine[] {
  return (extract.lines || []).map((line: PickTicketLine, i) => ({
    key: `l-${i}-${line.description}`,
    description: line.description || '',
    sku: line.sku || '',
    qty: String(line.qty > 0 ? line.qty : 1),
    unit_cost:
      line.unit_cost === null || line.unit_cost === undefined
        ? ''
        : String(line.unit_cost),
  }));
}

export function JobPickTickets({
  jobId,
  jobNumber,
  tickets,
  enableAi = false,
}: {
  jobId: string;
  jobNumber?: string | null;
  tickets: PickTicketAttachment[];
  enableAi?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [extractNotes, setExtractNotes] = useState<string | null>(null);

  const label = jobNumber?.trim() || jobId.slice(0, 8);

  const sorted = useMemo(
    () =>
      [...tickets].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [tickets]
  );

  async function onUpload(file: File | null) {
    if (!file) return;
    setPending('upload');
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const result = await uploadPickTicketAttachment(jobId, fd);
      if (result.error) setError(result.error);
      else {
        setMessage(result.success || 'Uploaded');
        if (result.attachmentId) setActiveId(result.attachmentId);
        router.refresh();
      }
    } catch {
      setError('Upload failed');
    }
    setPending(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function runExtract(attachmentId: string) {
    if (!enableAi) {
      setError('Turn on AI tools in Feature modules to extract pick tickets.');
      return;
    }
    setPending(`extract-${attachmentId}`);
    setError(null);
    setMessage(null);
    setActiveId(attachmentId);
    try {
      const res = await fetch('/api/ai/pick-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, attachmentId }),
      });
      const data = (await res.json()) as {
        extract?: PickTicketExtraction;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Extract failed');
      const extract = data.extract;
      if (!extract) throw new Error('No extract returned');
      setVendor(extract.vendor || '');
      setLines(linesFromExtract(extract));
      setExtractNotes(extract.notes || null);
      setMessage(
        extract.lines?.length
          ? `Found ${extract.lines.length} line${extract.lines.length === 1 ? '' : 's'} — review and add to job ${label}`
          : extract.notes || 'No lines found — try a clearer photo'
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extract failed');
    }
    setPending(null);
  }

  function loadSavedExtract(ticket: PickTicketAttachment) {
    setActiveId(ticket.id);
    if (ticket.extract_json?.lines?.length) {
      setVendor(ticket.extract_json.vendor || '');
      setLines(linesFromExtract(ticket.extract_json));
      setExtractNotes(ticket.extract_json.notes || null);
    } else {
      setLines([]);
      setVendor('');
      setExtractNotes(null);
    }
  }

  async function applyLines() {
    if (!activeId || !lines.length) return;
    setPending('apply');
    setError(null);
    setMessage(null);
    try {
      const payload = lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          sku: l.sku.trim() || null,
          qty: Number(l.qty) || 1,
          unit_cost: l.unit_cost.trim() === '' ? null : Number(l.unit_cost),
          vendor: vendor.trim() || null,
        }));
      const result = await applyPickTicketLines(jobId, activeId, payload);
      if (result.error) setError(result.error);
      else {
        setMessage(result.success || 'Parts added');
        setLines([]);
        router.refresh();
      }
    } catch {
      setError('Could not add parts');
    }
    setPending(null);
  }

  async function removeTicket(attachmentId: string) {
    setPending(`del-${attachmentId}`);
    setError(null);
    const result = await deletePickTicketAttachment(jobId, attachmentId);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Removed');
      if (activeId === attachmentId) {
        setActiveId(null);
        setLines([]);
      }
      router.refresh();
    }
    setPending(null);
  }

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Pick tickets
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Upload counter slips for job {label}. AI reads the photo into part
          orders on this job.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onUpload(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending === 'upload' ? 'Uploading…' : 'Upload pick ticket photo'}
        </button>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-ink-400">
          No pick tickets yet — photo a packing slip or counter ticket after
          pickup.
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-3">
          {sorted.map((ticket) => {
            const busy = pending === `extract-${ticket.id}` || pending === `del-${ticket.id}`;
            const hasExtract = Boolean(ticket.extract_json?.lines?.length);
            return (
              <li
                key={ticket.id}
                className={cn(
                  'rounded-xl border p-3',
                  activeId === ticket.id
                    ? 'border-brand-300 bg-brand-50/40'
                    : 'border-ink-200 bg-white'
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  {ticket.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ticket.url}
                      alt="Pick ticket"
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-ink-100"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-400">
                      No preview
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {ticket.caption || 'Pick ticket'}
                      {hasExtract ? (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          · extracted
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-400">
                      {new Date(ticket.created_at).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {enableAi && (
                        <button
                          type="button"
                          disabled={Boolean(pending)}
                          onClick={() => void runExtract(ticket.id)}
                          className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                        >
                          {pending === `extract-${ticket.id}`
                            ? 'Extracting…'
                            : 'Extract with AI'}
                        </button>
                      )}
                      {hasExtract && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => loadSavedExtract(ticket)}
                          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50"
                        >
                          Review extract
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={() => void removeTicket(ticket.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {activeId && lines.length > 0 && (
        <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <p className="text-sm font-semibold text-ink-900">
            Review lines → add to job {label}
          </p>
          {extractNotes && (
            <p className="text-xs text-ink-500">{extractNotes}</p>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-700">Vendor</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
              placeholder="Supply house"
            />
          </label>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-ink-100 bg-white p-2 sm:grid-cols-12"
              >
                <input
                  className="rounded border border-ink-200 px-2 py-1.5 text-sm sm:col-span-5"
                  value={line.description}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, description: e.target.value } : l
                      )
                    )
                  }
                  placeholder="Description"
                />
                <input
                  className="rounded border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2"
                  value={line.sku}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, sku: e.target.value } : l
                      )
                    )
                  }
                  placeholder="SKU"
                />
                <input
                  className="rounded border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2"
                  value={line.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, qty: e.target.value } : l
                      )
                    )
                  }
                  placeholder="Qty"
                />
                <input
                  className="rounded border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2"
                  value={line.unit_cost}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, unit_cost: e.target.value } : l
                      )
                    )
                  }
                  placeholder="Cost"
                />
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 sm:col-span-1"
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={pending === 'apply' || !lines.some((l) => l.description.trim())}
            onClick={() => void applyLines()}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending === 'apply'
              ? 'Adding…'
              : `Add parts to job ${label}`}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
    </section>
  );
}
