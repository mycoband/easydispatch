'use client';

import { useState } from 'react';
import { confirmAppointment, requestReschedule } from '@/app/confirm/actions';

export function ConfirmActions({
  token,
  initialStatus,
  initialRescheduleNote,
}: {
  token: string;
  initialStatus: string | null;
  initialRescheduleNote: string | null;
}) {
  const [status, setStatus] = useState(initialStatus || 'unsent');
  const [note, setNote] = useState(initialRescheduleNote ?? '');
  const [showReschedule, setShowReschedule] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await confirmAppointment(token);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Confirmed');
      setStatus('confirmed');
    }
    setPending(false);
  }

  async function onReschedule() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await requestReschedule(token, note);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Reschedule requested');
      setStatus('reschedule_requested');
      setShowReschedule(false);
    }
    setPending(false);
  }

  if (status === 'confirmed') {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-5 text-center">
        <p className="font-semibold text-emerald-800">
          You&apos;re confirmed — see you then!
        </p>
      </div>
    );
  }

  if (status === 'reschedule_requested') {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-5 text-center">
        <p className="font-semibold text-amber-900">
          Reschedule requested. We&apos;ll be in touch shortly.
        </p>
        {note && <p className="mt-2 text-sm text-amber-800">&ldquo;{note}&rdquo;</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Confirming…' : 'Confirm appointment'}
        </button>
        <button
          type="button"
          onClick={() => setShowReschedule((v) => !v)}
          disabled={pending}
          className="w-full rounded-xl border border-ink-200 bg-white py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          Request reschedule
        </button>
      </div>

      {showReschedule && (
        <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Let us know what days/times work better…"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
          <button
            type="button"
            onClick={onReschedule}
            disabled={pending}
            className="w-full rounded-lg bg-ink-900 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send reschedule request'}
          </button>
        </div>
      )}

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
