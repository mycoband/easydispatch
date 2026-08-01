'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendConfirmSms,
  sendCustomJobSms,
  sendOmwSms,
  sendReminderSms,
} from '@/app/dashboard/messages/actions';
import { cn } from '@/lib/utils';

const ETA_OPTIONS = [10, 15, 20, 30, 45, 60] as const;

export function JobMessageActions({
  jobId,
  hasPhone,
  allowCustom = false,
  large = false,
}: {
  jobId: string;
  hasPhone: boolean;
  allowCustom?: boolean;
  large?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [eta, setEta] = useState<number>(20);

  async function run(kind: 'omw' | 'reminder' | 'confirm' | 'custom') {
    setPending(kind);
    setError(null);
    setMessage(null);
    const result =
      kind === 'omw'
        ? await sendOmwSms(jobId, eta)
        : kind === 'reminder'
          ? await sendReminderSms(jobId)
          : kind === 'confirm'
            ? await sendConfirmSms(jobId)
            : await sendCustomJobSms(jobId, custom);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Sent');
      if (kind === 'custom') setCustom('');
      router.refresh();
    }
    setPending(null);
  }

  const btn = large
    ? 'w-full rounded-xl px-4 py-4 text-sm font-semibold transition disabled:opacity-50'
    : 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50';

  return (
    <section className="panel p-5">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Customer messages
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          On My Way with ETA · Reminder · Confirm appointment
          {!hasPhone && ' · add a customer phone first'}
        </p>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
          OMW ETA
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

      <div className={cn('grid gap-2', large ? 'grid-cols-1' : 'sm:grid-cols-3')}>
        <button
          type="button"
          disabled={!hasPhone || Boolean(pending)}
          onClick={() => run('omw')}
          className={cn(
            btn,
            hasPhone
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'omw' ? 'Sending…' : `On My Way · ${eta} min`}
        </button>
        <button
          type="button"
          disabled={!hasPhone || Boolean(pending)}
          onClick={() => run('reminder')}
          className={cn(
            btn,
            hasPhone
              ? 'bg-sky-600 text-white hover:bg-sky-700'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'reminder' ? 'Sending…' : 'Send Reminder'}
        </button>
        <button
          type="button"
          disabled={!hasPhone || Boolean(pending)}
          onClick={() => run('confirm')}
          className={cn(
            btn,
            hasPhone
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'confirm' ? 'Sending…' : 'Send Confirm'}
        </button>
      </div>

      {allowCustom && (
        <div className="mt-3 space-y-2">
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={2}
            maxLength={480}
            placeholder="Custom text to customer…"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
            disabled={!hasPhone || Boolean(pending)}
          />
          <button
            type="button"
            disabled={!hasPhone || !custom.trim() || Boolean(pending)}
            onClick={() => run('custom')}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold',
              hasPhone && custom.trim()
                ? 'bg-ink-900 text-white hover:bg-ink-800'
                : 'bg-ink-100 text-ink-400'
            )}
          >
            {pending === 'custom' ? 'Sending…' : 'Send text'}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
