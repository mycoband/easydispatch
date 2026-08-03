'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendDoneSms,
  sendOmwSms,
} from '@/app/dashboard/messages/actions';
import { doneBody, omwBody } from '@/lib/messages/templates';
import { cn } from '@/lib/utils';

const ETA_OPTIONS = [10, 15, 20, 30, 45, 60] as const;

export type CustomerDraftMode = 'omw' | 'done';

export type CustomerDraftContext = {
  techName: string | null;
  customerName: string | null;
  jobType: string | null;
  companyName: string | null;
  customerSummary?: string | null;
};

export function CustomerTextDraftSheet({
  open,
  mode,
  jobId,
  hasPhone,
  context,
  onClose,
}: {
  open: boolean;
  mode: CustomerDraftMode | null;
  jobId: string;
  hasPhone: boolean;
  context: CustomerDraftContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const [eta, setEta] = useState(20);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mode) return;
    setError(null);
    setPending(false);
    if (mode === 'omw') {
      setEta(20);
      setBody(
        omwBody({
          techName: context.techName,
          customerName: context.customerName,
          jobType: context.jobType,
          etaMinutes: 20,
          companyName: context.companyName,
        })
      );
    } else {
      setBody(
        doneBody({
          techName: context.techName,
          customerName: context.customerName,
          jobType: context.jobType,
          companyName: context.companyName,
          customerSummary: context.customerSummary,
        })
      );
    }
  }, [open, mode, context]);

  useEffect(() => {
    if (!open || mode !== 'omw') return;
    setBody(
      omwBody({
        techName: context.techName,
        customerName: context.customerName,
        jobType: context.jobType,
        etaMinutes: eta,
        companyName: context.companyName,
      })
    );
  }, [eta, open, mode, context]);

  if (!open || !mode) return null;

  const title = mode === 'omw' ? 'Text On My Way?' : 'Text customer you’re done?';
  const subtitle =
    mode === 'omw'
      ? 'After Drive Start — edit, then Send or Skip'
      : 'After Clock Out — edit, then Send or Skip';

  async function send() {
    if (!hasPhone || !body.trim() || pending) return;
    setPending(true);
    setError(null);
    const result =
      mode === 'omw'
        ? await sendOmwSms(jobId, eta, body)
        : await sendDoneSms(jobId, body);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-draft-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-ink-200 bg-white p-5 shadow-xl">
        <h2
          id="customer-draft-title"
          className="font-display text-lg font-semibold text-ink-950"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>

        {!hasPhone && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add a customer phone on this job before sending.
          </p>
        )}

        {mode === 'omw' && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              ETA
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ETA_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setEta(mins)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    eta === mins
                      ? 'bg-teal-600 text-white'
                      : 'border border-ink-200 bg-white text-ink-700'
                  )}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
            Message
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>

        {error && (
          <p className="mt-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasPhone || pending || !body.trim()}
            onClick={() => void send()}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
