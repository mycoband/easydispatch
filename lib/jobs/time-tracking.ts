export type JobTimeFields = {
  status?: string | null;
  assigned_to?: string | null;
  drive_started_at?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  actual_hours?: number | null;
};

export type LiveStatus =
  | 'Unassigned'
  | 'Scheduled'
  | 'En Route'
  | 'On Site'
  | 'Completed'
  | 'Cancelled'
  | 'New';

export function deriveLiveStatus(job: JobTimeFields): LiveStatus {
  if (job.status === 'Cancelled') return 'Cancelled';
  if (job.check_out_at || job.status === 'Completed') return 'Completed';
  if (job.check_in_at) return 'On Site';
  if (job.drive_started_at) return 'En Route';
  if (!job.assigned_to) return 'Unassigned';
  if (job.status === 'Scheduled') return 'Scheduled';
  if (job.status === 'New') return 'New';
  return (job.status as LiveStatus) || 'New';
}

export function minutesBetween(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

export function hoursBetween(startIso: string, endIso: string) {
  const mins = minutesBetween(startIso, endIso);
  return Math.round((mins / 60) * 100) / 100;
}

export function formatDurationMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function buildTimeLog(job: JobTimeFields) {
  const driveMins =
    job.drive_started_at && job.check_in_at
      ? minutesBetween(job.drive_started_at, job.check_in_at)
      : null;
  const workHours =
    job.check_in_at && job.check_out_at
      ? hoursBetween(job.check_in_at, job.check_out_at)
      : job.actual_hours != null
        ? Number(job.actual_hours)
        : null;

  return {
    driveStartedAt: job.drive_started_at ?? null,
    arrivedAt: job.check_in_at ?? null,
    clockedOutAt: job.check_out_at ?? null,
    checkInLat: job.check_in_lat ?? null,
    checkInLng: job.check_in_lng ?? null,
    driveMins,
    workHours,
    liveStatus: deriveLiveStatus(job),
  };
}
