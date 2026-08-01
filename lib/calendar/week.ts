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
