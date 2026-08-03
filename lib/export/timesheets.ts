import { hoursBetween } from '@/lib/jobs/time-tracking';
import { qbDate } from '@/lib/export/csv';

/** FLSA-style weekly OT threshold (hours). Workweek starts Monday (UTC). */
export const WEEKLY_OT_THRESHOLD = 40;

export type TimesheetJobRow = {
  assigned_to: string | null;
  assigned_to_name: string | null;
  job_number: string | null;
  customer_name: string | null;
  job_type: string | null;
  status: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  actual_hours: number | null;
  drive_started_at?: string | null;
};

export type TimesheetCsvRow = {
  employeeName: string;
  employeeId: string;
  date: string;
  weekOf: string;
  jobNumber: string;
  customer: string;
  startTime: string;
  endTime: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  hourlyRate: string;
  notes: string;
};

/** Monday (UTC) YYYY-MM-DD for the ISO-ish workweek containing `iso`. */
export function workweekMondayUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff)
  );
  return monday.toISOString().slice(0, 10);
}

export function jobWorkHours(job: TimesheetJobRow): number {
  if (job.check_in_at && job.check_out_at) {
    return hoursBetween(job.check_in_at, job.check_out_at);
  }
  return Math.round((Number(job.actual_hours) || 0) * 100) / 100;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

/**
 * Split job hours into regular / OT using a running weekly total per tech
 * (Mon–Sun UTC, first 40 hrs regular). Jobs must be sorted by check_out_at.
 * Pass jobs from the start of the first week through `to` so OT is accurate
 * at the beginning of the export window; filter output with `inRange`.
 */
export function buildTimesheetRows(
  jobs: TimesheetJobRow[],
  ratesByTechId: Map<string, number>,
  inRange: (checkOutIso: string) => boolean
): TimesheetCsvRow[] {
  const sorted = [...jobs].sort((a, b) => {
    const ta = a.check_out_at || '';
    const tb = b.check_out_at || '';
    return ta.localeCompare(tb);
  });

  /** key = `${techId}|${weekMonday}` → regular hours already counted */
  const regularUsed = new Map<string, number>();
  const rows: TimesheetCsvRow[] = [];

  for (const job of sorted) {
    if (!job.check_out_at) continue;
    const hours = jobWorkHours(job);
    if (hours <= 0) continue;

    const techId = job.assigned_to || 'unassigned';
    const weekOf = workweekMondayUtc(job.check_out_at);
    const bucket = `${techId}|${weekOf}`;
    const used = regularUsed.get(bucket) || 0;
    const regularRoom = Math.max(0, WEEKLY_OT_THRESHOLD - used);
    const regular = Math.min(hours, regularRoom);
    const overtime = Math.round((hours - regular) * 100) / 100;
    const regularRounded = Math.round(regular * 100) / 100;
    regularUsed.set(bucket, Math.round((used + regularRounded) * 100) / 100);

    if (!inRange(job.check_out_at)) continue;

    const rate = job.assigned_to
      ? ratesByTechId.get(job.assigned_to)
      : undefined;

    rows.push({
      employeeName: job.assigned_to_name || 'Unassigned',
      employeeId: job.assigned_to || '',
      date: qbDate(job.check_out_at),
      weekOf,
      jobNumber: job.job_number || '',
      customer: job.customer_name || '',
      startTime: formatTime(job.check_in_at),
      endTime: formatTime(job.check_out_at),
      regularHours: regularRounded,
      overtimeHours: overtime,
      totalHours: Math.round(hours * 100) / 100,
      hourlyRate:
        rate != null && rate > 0 ? rate.toFixed(2) : '',
      notes: [job.job_type, job.status].filter(Boolean).join(' · '),
    });
  }

  return rows;
}

/** ISO for Monday 00:00 UTC of the week containing `from` (YYYY-MM-DD). */
export function weekStartIsoForDate(fromYmd: string): string {
  const monday = workweekMondayUtc(`${fromYmd}T12:00:00.000Z`);
  return `${monday || fromYmd}T00:00:00.000Z`;
}

export const TIMESHEET_CSV_HEADERS = [
  'Employee Name',
  'Employee ID',
  'Date',
  'Week Of (Mon)',
  'Job Number',
  'Customer',
  'Start Time (UTC)',
  'End Time (UTC)',
  'Regular Hours',
  'Overtime Hours',
  'Total Hours',
  'Hourly Cost Rate',
  'Notes',
] as const;

export function timesheetRowsToCsvValues(rows: TimesheetCsvRow[]) {
  return rows.map((r) => [
    r.employeeName,
    r.employeeId,
    r.date,
    r.weekOf,
    r.jobNumber,
    r.customer,
    r.startTime,
    r.endTime,
    r.regularHours.toFixed(2),
    r.overtimeHours.toFixed(2),
    r.totalHours.toFixed(2),
    r.hourlyRate,
    r.notes,
  ]);
}
