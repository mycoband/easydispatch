'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackJobTime } from '@/app/dashboard/jobs/time-actions';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import {
  buildTimeLog,
  formatDurationMinutes,
  formatTimestamp,
  type JobTimeFields,
} from '@/lib/jobs/time-tracking';
import { cn } from '@/lib/utils';

export function TimeTrackingPanel({
  jobId,
  job,
  large = false,
}: {
  jobId: string;
  job: JobTimeFields;
  large?: boolean;
}) {
  const router = useRouter();
  const log = buildTimeLog(job);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canDrive = !job.drive_started_at && !job.check_out_at;
  const canArrive = !job.check_in_at && !job.check_out_at;
  const canClockOut = !job.check_out_at && Boolean(job.check_in_at || job.drive_started_at);

  function getCurrentPosition(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  async function run(action: 'drive' | 'arrive' | 'clock_out') {
    setPending(action);
    setError(null);
    setMessage(null);

    let coords: { lat?: number; lng?: number } | undefined;
    if (action === 'arrive') {
      const pos = await getCurrentPosition();
      if (pos) {
        coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      }
      // If geolocation is denied/unavailable, we still arrive without coords.
    }

    const result = await trackJobTime(jobId, action, coords);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Updated');
      router.refresh();
    }
    setPending(null);
  }

  const btnBase = large
    ? 'w-full rounded-xl px-4 py-5 text-base font-semibold transition disabled:opacity-50'
    : 'rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50';

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Time tracking
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Drive Start → Arrive / Start Work → Clock Out
          </p>
        </div>
        <LiveStatusBadge status={log.liveStatus} />
      </div>

      <div className={cn('grid gap-2', large ? 'grid-cols-1' : 'sm:grid-cols-3')}>
        <button
          type="button"
          disabled={!canDrive || Boolean(pending)}
          onClick={() => run('drive')}
          className={cn(
            btnBase,
            canDrive
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'drive' ? 'Starting…' : 'Drive Start'}
        </button>
        <button
          type="button"
          disabled={!canArrive || Boolean(pending)}
          onClick={() => run('arrive')}
          className={cn(
            btnBase,
            canArrive
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'arrive' ? 'Saving…' : 'Arrive / Start Work'}
        </button>
        <button
          type="button"
          disabled={!canClockOut || Boolean(pending)}
          onClick={() => run('clock_out')}
          className={cn(
            btnBase,
            canClockOut
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-ink-100 text-ink-400'
          )}
        >
          {pending === 'clock_out' ? 'Saving…' : 'Clock Out'}
        </button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Drive Start</dt>
          <dd className="mt-0.5 font-medium text-ink-900">
            {formatTimestamp(log.driveStartedAt)}
          </dd>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Arrive / Start Work</dt>
          <dd className="mt-0.5 font-medium text-ink-900">
            {formatTimestamp(log.arrivedAt)}
          </dd>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Clock Out</dt>
          <dd className="mt-0.5 font-medium text-ink-900">
            {formatTimestamp(log.clockedOutAt)}
          </dd>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Drive / work time</dt>
          <dd className="mt-0.5 font-medium text-ink-900">
            {log.driveMins != null
              ? `Drive ${formatDurationMinutes(log.driveMins)}`
              : 'Drive —'}
            {' · '}
            {log.workHours != null ? `Work ${log.workHours}h` : 'Work —'}
          </dd>
        </div>
        {(log.checkInLat != null && log.checkInLng != null) && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 sm:col-span-2">
            <dt className="text-ink-500">Arrival GPS</dt>
            <dd className="mt-0.5 font-medium text-ink-900">
              <a
                href={`https://maps.google.com/?q=${log.checkInLat},${log.checkInLng}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline"
              >
                {log.checkInLat.toFixed(5)}, {log.checkInLng.toFixed(5)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {message && (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
