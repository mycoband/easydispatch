import { localDateKey } from '@/lib/calendar/week';

/** Default est hours when job has none (align day-sheet + dispatch). */
export const DEFAULT_EST_HOURS = 1.5;

/** Soft day capacity before “overbooked” warning. */
export const DAY_CAPACITY_HOURS = 8;

export type CapacityJob = {
  id: string;
  assigned_to?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  est_hours?: number | null;
  status?: string | null;
};

export type JobWindow = {
  jobId: string;
  startMs: number;
  endMs: number;
};

export function estHoursOf(job: { est_hours?: number | null }) {
  const n = Number(job.est_hours);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EST_HOURS;
}

/** Inclusive window from scheduled_start → scheduled_end or + est hours. */
export function jobWindow(job: CapacityJob): JobWindow | null {
  if (!job.scheduled_start) return null;
  const startMs = new Date(job.scheduled_start).getTime();
  if (Number.isNaN(startMs)) return null;
  let endMs: number;
  if (job.scheduled_end) {
    endMs = new Date(job.scheduled_end).getTime();
    if (Number.isNaN(endMs) || endMs <= startMs) {
      endMs = startMs + estHoursOf(job) * 3600_000;
    }
  } else {
    endMs = startMs + estHoursOf(job) * 3600_000;
  }
  return { jobId: job.id, startMs, endMs };
}

export function windowsOverlap(a: JobWindow, b: JobWindow) {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Jobs that overlap another assigned job the same local day. */
export function findOverlappingJobIds(
  jobs: CapacityJob[],
  dayKey?: string
): Set<string> {
  const key = dayKey || localDateKey(new Date());
  const active = jobs.filter((j) => {
    if (!j.assigned_to) return false;
    if (j.status === 'Cancelled') return false;
    if (!j.scheduled_start) return false;
    const local = new Date(j.scheduled_start);
    const localKey = localDateKey(local);
    const isoKey = j.scheduled_start.slice(0, 10);
    return localKey === key || isoKey === key;
  });

  const byTech = new Map<string, CapacityJob[]>();
  for (const j of active) {
    const tid = j.assigned_to!;
    const list = byTech.get(tid) || [];
    list.push(j);
    byTech.set(tid, list);
  }

  const overlapping = new Set<string>();
  for (const list of byTech.values()) {
    const windows = list
      .map(jobWindow)
      .filter((w): w is JobWindow => Boolean(w));
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        if (windowsOverlap(windows[i], windows[j])) {
          overlapping.add(windows[i].jobId);
          overlapping.add(windows[j].jobId);
        }
      }
    }
  }
  return overlapping;
}

export function dayHoursForTech(
  jobs: CapacityJob[],
  techId: string,
  dayKey: string
) {
  let hours = 0;
  let count = 0;
  for (const j of jobs) {
    if (j.assigned_to !== techId || j.status === 'Cancelled') continue;
    if (!j.scheduled_start) continue;
    const local = new Date(j.scheduled_start);
    const localKey = localDateKey(local);
    const isoKey = j.scheduled_start.slice(0, 10);
    if (localKey !== dayKey && isoKey !== dayKey) continue;
    hours += estHoursOf(j);
    count += 1;
  }
  return { hours, count };
}

export function isOverloaded(hours: number) {
  return hours > DAY_CAPACITY_HOURS;
}
