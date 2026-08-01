'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  type CalendarView,
  localDateKey,
  monthOffsetForDateKey,
  weekOffsetForDateKey,
} from '@/lib/calendar/week';
import { cn } from '@/lib/utils';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarDateJump({
  view,
  highlightDate,
}: {
  view: CalendarView;
  currentWeekOffset?: number;
  currentMonthOffset?: number;
  highlightDate?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    if (highlightDate) {
      try {
        return startOfMonth(parseISO(`${highlightDate}T12:00:00`));
      } catch {
        /* fall through */
      }
    }
    return startOfMonth(new Date());
  });

  const cells = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = new Date(gridStart);
    end.setDate(gridStart.getDate() + 41);
    return eachDayOfInterval({ start: gridStart, end });
  }, [cursor]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  function goToDate(dateKey: string, mode: 'navigate' | 'schedule') {
    if (mode === 'schedule') {
      router.push(`/dashboard/jobs/new?date=${dateKey}`);
      setOpen(false);
      return;
    }
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('date', dateKey);
    if (view === 'month') {
      params.set('month', String(monthOffsetForDateKey(dateKey)));
    } else {
      params.set('week', String(weekOffsetForDateKey(dateKey)));
    }
    router.push(`/dashboard/calendar?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50"
      >
        Jump to date
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-ink-950/10"
            aria-label="Close date picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[320px] rounded-2xl border border-ink-200 bg-white p-3 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              <select
                className="flex-1 rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
                value={month}
                onChange={(e) =>
                  setCursor(new Date(year, Number(e.target.value), 1))
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {format(new Date(2020, i, 1), 'MMMM')}
                  </option>
                ))}
              </select>
              <select
                className="w-[96px] rounded-lg border border-ink-200 px-2 py-1.5 text-sm"
                value={year}
                onChange={(e) =>
                  setCursor(new Date(Number(e.target.value), month, 1))
                }
              >
                {Array.from({ length: 7 }, (_, i) => year - 2 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-ink-600 hover:bg-ink-50"
                onClick={() => setCursor(addMonths(cursor, -1))}
              >
                ←
              </button>
              <p className="text-sm font-semibold text-ink-900">
                {format(cursor, 'MMMM yyyy')}
              </p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-ink-600 hover:bg-ink-50"
                onClick={() => setCursor(addMonths(cursor, 1))}
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-ink-400">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day) => {
                const key = localDateKey(day);
                const inMonth = isSameMonth(day, cursor);
                const selected = highlightDate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => goToDate(key, 'navigate')}
                    onDoubleClick={() => goToDate(key, 'schedule')}
                    title="Click: jump · Double-click: schedule job"
                    className={cn(
                      'rounded-lg py-1.5 text-xs font-medium transition',
                      !inMonth && 'text-ink-300',
                      inMonth && 'text-ink-800 hover:bg-brand-50',
                      selected && 'bg-brand-600 text-white hover:bg-brand-700'
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-[10px] text-ink-400">
              Click a day to jump in {view} view. Double-click to schedule.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-ink-200 py-1.5 text-xs font-medium hover:bg-ink-50"
                onClick={() => {
                  const today = localDateKey(new Date());
                  goToDate(today, 'navigate');
                }}
              >
                Jump to today
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-ink-900 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
