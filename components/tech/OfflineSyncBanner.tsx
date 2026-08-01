'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackJobTime } from '@/app/dashboard/jobs/time-actions';
import { saveTechJobNotes } from '@/app/tech/actions';
import {
  countQueuedForJob,
  isBenignTimeError,
  isBrowserOffline,
  readOfflineQueue,
  removeOfflineItem,
  type OfflineQueueItem,
} from '@/lib/tech/offline-queue';

/**
 * Shows offline / queued status and flushes the write queue when online.
 */
export function OfflineSyncBanner({
  jobId,
  enabled = true,
}: {
  jobId?: string;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    setQueued(
      jobId ? countQueuedForJob(jobId) : readOfflineQueue().length
    );
  }, [jobId]);

  const flush = useCallback(async () => {
    if (isBrowserOffline()) return;
    const all = readOfflineQueue();
    const items = jobId ? all.filter((i) => i.jobId === jobId) : all;
    if (!items.length) {
      refreshCount();
      return;
    }
    setSyncing(true);
    setMsg(null);
    let ok = 0;
    let fail = 0;
    for (const item of items) {
      const result = await applyItem(item);
      if (result.ok) {
        removeOfflineItem(item.id);
        ok += 1;
      } else {
        fail += 1;
        setMsg(result.error || 'Sync failed');
        break;
      }
    }
    setSyncing(false);
    refreshCount();
    if (ok > 0) {
      setMsg(
        fail
          ? `Synced ${ok}, then stopped (fix remaining)`
          : `Synced ${ok} queued change${ok === 1 ? '' : 's'}`
      );
      router.refresh();
    }
  }, [jobId, refreshCount, router]);

  useEffect(() => {
    if (!enabled) return;
    function syncOnline() {
      setOffline(isBrowserOffline());
      refreshCount();
      if (!isBrowserOffline()) void flush();
    }
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    window.addEventListener('ed-offline-queue', refreshCount);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
      window.removeEventListener('ed-offline-queue', refreshCount);
    };
  }, [enabled, flush, refreshCount]);

  if (!enabled || (!offline && queued === 0 && !msg)) return null;

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        offline
          ? 'border-amber-300 bg-amber-50 text-amber-950'
          : 'border-brand-200 bg-brand-50 text-brand-950'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          {offline
            ? 'Offline — notes & time will queue until you’re back online'
            : syncing
              ? 'Syncing queued changes…'
              : queued > 0
                ? `${queued} change${queued === 1 ? '' : 's'} waiting to sync`
                : msg || ''}
        </p>
        {!offline && queued > 0 && (
          <button
            type="button"
            disabled={syncing}
            onClick={() => void flush()}
            className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Sync now
          </button>
        )}
      </div>
      {msg && !offline && (
        <p className="mt-1 text-xs opacity-80">{msg}</p>
      )}
    </div>
  );
}

async function applyItem(
  item: OfflineQueueItem
): Promise<{ ok: boolean; error?: string }> {
  if (item.kind === 'time') {
    const result = await trackJobTime(item.jobId, item.action, item.coords);
    if (result.error && !isBenignTimeError(result.error)) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }
  const result = await saveTechJobNotes(item.jobId, {
    diagnosis: item.diagnosis,
    customer_summary: item.customer_summary,
    internal_notes: item.internal_notes,
  });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export function notifyOfflineQueueChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('ed-offline-queue'));
}
