import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type CalendarView = 'month' | 'week';

export function weekStartFromOffset(offset: number, now = new Date()) {
  return addWeeks(startOfWeek(now, { weekStartsOn: 0 }), offset);
}

export function monthStartFromOffset(offset: number, now = new Date()) {
  return addMonths(startOfMonth(now), offset);
}

/** Month offset (from this month) that contains the given local YYYY-MM-DD. */
export function monthOffsetForDateKey(dateKey: string, now = new Date()) {
  const target = startOfMonth(parseISO(`${dateKey}T12:00:00`));
  const current = startOfMonth(now);
  return differenceInCalendarMonths(target, current);
}

/** Sunday-start grid covering the month (usually 5–6 weeks). */
export function monthGridDays(monthStart: Date) {
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const end = addDays(gridStart, 41);
  return eachDayOfInterval({ start: gridStart, end });
}

export function monthLabel(offset: number, monthStart: Date) {
  if (offset === 0) return 'This month';
  if (offset === 1) return 'Next month';
  if (offset === -1) return 'Last month';
  return format(monthStart, 'MMMM yyyy');
}

/** Week offset (from this week) that contains the given local YYYY-MM-DD. */
export function weekOffsetForDateKey(dateKey: string, now = new Date()) {
  const target = startOfWeek(parseISO(`${dateKey}T12:00:00`), {
    weekStartsOn: 0,
  });
  const current = startOfWeek(now, { weekStartsOn: 0 });
  return differenceInCalendarWeeks(target, current, { weekStartsOn: 0 });
}

export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function localDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function scheduledLocalDateKey(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return localDateKey(parseISO(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function weekLabel(offset: number, weekStart: Date) {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  return `${format(weekStart, 'MMM d')} week`;
}

export function defaultScheduleIsoForDate(dateKey: string, hour = 9) {
  // Local noon-safe default: YYYY-MM-DD at hour:00 local
  const d = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Keep the local clock time from `iso`, but place it on `dateKey` (YYYY-MM-DD).
 * If there was no prior schedule, defaults to 9:00 local on that date.
 */
export function rescheduleIsoToDateKey(
  iso: string | null | undefined,
  dateKey: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!iso) return defaultScheduleIsoForDate(dateKey, 9);

  try {
    const prev = parseISO(iso);
    if (Number.isNaN(prev.getTime())) return defaultScheduleIsoForDate(dateKey, 9);
    const next = new Date(
      y,
      m - 1,
      d,
      prev.getHours(),
      prev.getMinutes(),
      prev.getSeconds(),
      0
    );
    return next.toISOString();
  } catch {
    return defaultScheduleIsoForDate(dateKey, 9);
  }
}

export function isToday(date: Date, now = new Date()) {
  return isSameDay(date, now);
}

/** Local HH:mm from ISO for time inputs. */
export function localTimeHm(iso: string | null | undefined) {
  if (!iso) return '09:00';
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return '09:00';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '09:00';
  }
}

/**
 * Build ISO for dateKey (YYYY-MM-DD) at local HH:mm.
 * Optionally set scheduled_end from estHours.
 */
export function scheduleIsoOnDate(
  dateKey: string,
  timeHm: string,
  estHours?: number | null
): { start: string; end: string | null } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  const [y, mo, d] = dateKey.split('-').map(Number);
  const start = new Date(y, mo - 1, d, hours, minutes, 0, 0);
  if (Number.isNaN(start.getTime())) return null;
  let end: string | null = null;
  if (estHours != null && Number.isFinite(estHours) && estHours > 0) {
    const endDate = new Date(start.getTime() + estHours * 60 * 60 * 1000);
    end = endDate.toISOString();
  }
  return { start: start.toISOString(), end };
}
