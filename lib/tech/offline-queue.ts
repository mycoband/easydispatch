/**
 * Offline write queue for tech notes + time tracking.
 * Persists in localStorage; flush when back online.
 */

export type OfflineTimeAction = 'drive' | 'arrive' | 'clock_out';

export type OfflineQueueItem =
  | {
      id: string;
      kind: 'time';
      jobId: string;
      action: OfflineTimeAction;
      coords?: { lat?: number; lng?: number };
      queuedAt: string;
    }
  | {
      id: string;
      kind: 'notes';
      jobId: string;
      diagnosis: string;
      customer_summary: string;
      internal_notes: string;
      queuedAt: string;
    };

const STORAGE_KEY = 'ed-offline-writes';

function uid() {
  return `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items: OfflineQueueItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function enqueueOfflineItem(
  item:
    | {
        kind: 'time';
        jobId: string;
        action: OfflineTimeAction;
        coords?: { lat?: number; lng?: number };
        queuedAt?: string;
      }
    | {
        kind: 'notes';
        jobId: string;
        diagnosis: string;
        customer_summary: string;
        internal_notes: string;
        queuedAt?: string;
      }
): OfflineQueueItem {
  const full = {
    ...item,
    id: uid(),
    queuedAt: item.queuedAt || new Date().toISOString(),
  } as OfflineQueueItem;
  const next = [...readOfflineQueue(), full];
  writeOfflineQueue(next);
  return full;
}

export function removeOfflineItem(id: string) {
  writeOfflineQueue(readOfflineQueue().filter((i) => i.id !== id));
}

export function countQueuedForJob(jobId: string) {
  return readOfflineQueue().filter((i) => i.jobId === jobId).length;
}

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/** Treat as “already done” so flush can continue. */
export function isBenignTimeError(message: string) {
  return /already|clocked out|not assigned/i.test(message);
}
