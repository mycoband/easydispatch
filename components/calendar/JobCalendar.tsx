'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from 'react';
import { isSameMonth } from 'date-fns';
import { moveJobToDate } from '@/app/dashboard/calendar/actions';
import { CalendarDateJump } from '@/components/calendar/CalendarDateJump';
import {
  type CalendarView,
  isToday,
  localDateKey,
  monthGridDays,
  monthLabel,
  monthOffsetForDateKey,
  monthStartFromOffset,
  rescheduleIsoToDateKey,
  scheduledLocalDateKey,
  weekDays,
  weekLabel,
  weekOffsetForDateKey,
  weekStartFromOffset,
} from '@/lib/calendar/week';
import { cn } from '@/lib/utils';

export type CalendarJob = {
  id: string;
  job_number: string | null;
  customer_name: string | null;
  job_type: string | null;
  priority: string | null;
  assigned_to_name: string | null;
  scheduled_start: string | null;
  status: string | null;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DRAG_MIME = 'application/x-easydispatch-job';

function hrefFor(
  view: CalendarView,
  opts: { week?: number; month?: number; date?: string | null }
) {
  const params = new URLSearchParams();
  params.set('view', view);
  if (view === 'week') {
    params.set('week', String(opts.week ?? 0));
  } else {
    params.set('month', String(opts.month ?? 0));
  }
  if (opts.date) params.set('date', opts.date);
  return `/dashboard/calendar?${params.toString()}`;
}

function groupJobs(jobs: CalendarJob[]) {
  const byDay = new Map<string, CalendarJob[]>();
  for (const job of jobs) {
    const key = scheduledLocalDateKey(job.scheduled_start);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(job);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => {
      const ta = a.scheduled_start
        ? new Date(a.scheduled_start).getTime()
        : 0;
      const tb = b.scheduled_start
        ? new Date(b.scheduled_start).getTime()
        : 0;
      return ta - tb;
    });
  }
  return byDay;
}

export function JobCalendar({
  view,
  weekOffset,
  monthOffset,
  jobs,
  highlightDate,
}: {
  view: CalendarView;
  weekOffset: number;
  monthOffset: number;
  jobs: CalendarJob[];
  highlightDate?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localJobs, setLocalJobs] = useState(jobs);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragMoved = useRef(false);

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  const weekStart = weekStartFromOffset(weekOffset);
  const monthStart = monthStartFromOffset(monthOffset);
  const days =
    view === 'month' ? monthGridDays(monthStart) : weekDays(weekStart);
  const label =
    view === 'month'
      ? monthLabel(monthOffset, monthStart)
      : weekLabel(weekOffset, weekStart);

  const byDay = useMemo(() => groupJobs(localJobs), [localJobs]);

  const prevHref =
    view === 'month'
      ? hrefFor('month', { month: monthOffset - 1 })
      : hrefFor('week', { week: weekOffset - 1 });
  const nextHref =
    view === 'month'
      ? hrefFor('month', { month: monthOffset + 1 })
      : hrefFor('week', { week: weekOffset + 1 });

  const isCurrentPeriod =
    view === 'month' ? monthOffset === 0 : weekOffset === 0;
  const maxJobsPerCell = view === 'month' ? 3 : 99;

  const anchorDate =
    highlightDate ||
    (view === 'month'
      ? localDateKey(
          monthOffset === 0 ? new Date() : monthStartFromOffset(monthOffset)
        )
      : localDateKey(
          weekOffset === 0 ? new Date() : weekStartFromOffset(weekOffset)
        ));
  const toggleMonthHref = hrefFor('month', {
    month: monthOffsetForDateKey(anchorDate),
    date: highlightDate,
  });
  const toggleWeekHref = hrefFor('week', {
    week: weekOffsetForDateKey(anchorDate),
    date: highlightDate,
  });

  function onDragStart(e: DragEvent, job: CalendarJob) {
    dragMoved.current = false;
    setDraggingId(job.id);
    setError(null);
    e.dataTransfer.setData(DRAG_MIME, job.id);
    e.dataTransfer.setData('text/plain', job.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverDate(null);
  }

  function onDragOverDay(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateKey) setDragOverDate(dateKey);
  }

  function onDragEnterDay(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  }

  /** Ignore leave events that are just moving into a child (label, +, job chip). */
  function onDragLeaveDay(e: DragEvent, dateKey: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (dragOverDate === dateKey) setDragOverDate(null);
  }

  function applyOptimisticMove(jobId: string, dateKey: string) {
    setLocalJobs((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;
        const nextIso = rescheduleIsoToDateKey(j.scheduled_start, dateKey);
        return {
          ...j,
          scheduled_start: nextIso,
          status: j.status === 'New' ? 'Scheduled' : j.status,
        };
      })
    );
  }

  function onDropDay(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.stopPropagation();
    const jobId =
      e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    setDragOverDate(null);
    setDraggingId(null);
    if (!jobId) return;

    const job = localJobs.find((j) => j.id === jobId);
    const currentKey = scheduledLocalDateKey(job?.scheduled_start);
    if (currentKey === dateKey) return;

    dragMoved.current = true;
    const snapshot = localJobs;
    applyOptimisticMove(jobId, dateKey);

    startTransition(async () => {
      const result = await moveJobToDate(jobId, dateKey);
      if (result.error) {
        setLocalJobs(snapshot);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function openJob(jobId: string) {
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    router.push(`/dashboard/jobs/${jobId}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Drag a job onto another day to reschedule · time of day is kept
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-0.5 text-sm">
            <Link
              href={toggleMonthHref}
              className={cn(
                'rounded-[10px] px-3 py-1.5 font-medium transition',
                view === 'month'
                  ? 'bg-ink-900 text-white'
                  : 'text-ink-600 hover:bg-ink-50'
              )}
            >
              Month
            </Link>
            <Link
              href={toggleWeekHref}
              className={cn(
                'rounded-[10px] px-3 py-1.5 font-medium transition',
                view === 'week'
                  ? 'bg-ink-900 text-white'
                  : 'text-ink-600 hover:bg-ink-50'
              )}
            >
              Week
            </Link>
          </div>
          <Link
            href={prevHref}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            ← Prev
          </Link>
          <span className="min-w-[7rem] text-center text-sm font-medium text-ink-700">
            {label}
          </span>
          <Link
            href={nextHref}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            Next →
          </Link>
          <CalendarDateJump
            view={view}
            currentWeekOffset={weekOffset}
            currentMonthOffset={monthOffset}
            highlightDate={highlightDate}
          />
          {!isCurrentPeriod && (
            <Link
              href={hrefFor(view, view === 'month' ? { month: 0 } : { week: 0 })}
              className="rounded-xl px-3 py-1.5 text-sm text-ink-500 hover:text-ink-800"
            >
              Today
            </Link>
          )}
          <Link
            href="/dashboard/jobs/new"
            className="rounded-xl bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink-800"
          >
            + Schedule job
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Couldn’t move job: {error}
        </p>
      )}
      {pending && (
        <p className="text-xs font-medium text-ink-400">Saving schedule…</p>
      )}

      <div className="panel overflow-hidden">
        <div className="hidden grid-cols-7 border-b border-ink-100 bg-ink-50/80 text-xs font-semibold text-ink-500 sm:grid">
          {DAY_NAMES.map((name) => (
            <div key={name} className="p-3 text-center">
              {name}
            </div>
          ))}
        </div>
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-7',
            view === 'month' && 'sm:auto-rows-fr'
          )}
        >
          {days.map((day) => {
            const key = localDateKey(day);
            const dayJobs = byDay.get(key) || [];
            const today = isToday(day);
            const highlighted = highlightDate === key;
            const inMonth =
              view === 'week' ? true : isSameMonth(day, monthStart);
            const visibleJobs = dayJobs.slice(0, maxJobsPerCell);
            const overflow = dayJobs.length - visibleJobs.length;
            const isDropTarget = dragOverDate === key;
            const dragging = Boolean(draggingId);

            return (
              <div
                key={key}
                onDragEnter={(e) => onDragEnterDay(e, key)}
                onDragOver={(e) => onDragOverDay(e, key)}
                onDragLeave={(e) => onDragLeaveDay(e, key)}
                onDrop={(e) => onDropDay(e, key)}
                className={cn(
                  'relative flex flex-col border-b border-ink-100 p-2 sm:border-r sm:last:border-r-0',
                  view === 'month'
                    ? 'min-h-[110px] sm:min-h-[120px]'
                    : 'min-h-[140px]',
                  !inMonth && 'bg-ink-50/60',
                  inMonth && today && 'bg-brand-50/40',
                  inMonth && highlighted && !today && 'bg-amber-50/50',
                  inMonth && !today && !highlighted && 'bg-white',
                  isDropTarget && 'ring-2 ring-inset ring-brand-500 bg-brand-50'
                )}
              >
                {/*
                  While dragging, disable pointer events on labels/links/chips
                  so the whole cell (including the top date row) stays a drop
                  target. Source chip stays interactive so HTML5 drag continues.
                */}
                <div
                  className={cn(
                    'mb-2 flex items-center justify-between gap-1',
                    dragging && 'pointer-events-none'
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      !inMonth && 'text-ink-300',
                      inMonth && today && 'text-brand-800',
                      inMonth && !today && 'text-ink-500',
                      highlighted && inMonth && 'text-amber-900'
                    )}
                  >
                    <span className="sm:hidden">{DAY_NAMES[day.getDay()]} </span>
                    {view === 'month' ? (
                      <Link
                        href={hrefFor('week', {
                          week: weekOffsetForDateKey(key),
                          date: key,
                        })}
                        className="hover:underline"
                        title="Open week view"
                      >
                        {day.getDate()}
                      </Link>
                    ) : (
                      day.getDate()
                    )}
                    {today && inMonth ? ' · Today' : ''}
                  </p>
                  <Link
                    href={`/dashboard/jobs/new?date=${key}`}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    title="Schedule job this day"
                  >
                    +
                  </Link>
                </div>

                <div
                  className={cn(
                    'flex flex-1 flex-col space-y-1.5',
                    dragging && 'pointer-events-none'
                  )}
                >
                  {dayJobs.length === 0 ? (
                    inMonth || isDropTarget ? (
                      <p
                        className={cn(
                          'flex flex-1 items-center justify-center text-center text-[10px] text-ink-300',
                          view === 'month' ? 'min-h-[48px]' : 'min-h-[72px]',
                          isDropTarget && 'text-brand-600'
                        )}
                      >
                        {isDropTarget
                          ? 'Drop to schedule'
                          : view === 'month'
                            ? '—'
                            : 'No jobs — drag here or schedule'}
                      </p>
                    ) : null
                  ) : (
                    <>
                      {visibleJobs.map((job) => {
                        const high =
                          job.priority === 'High' ||
                          job.priority === 'Emergency';
                        const time = job.scheduled_start
                          ? new Date(job.scheduled_start).toLocaleTimeString(
                              'en-US',
                              { hour: 'numeric', minute: '2-digit' }
                            )
                          : '';
                        const isSource = draggingId === job.id;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            draggable
                            onDragStart={(e) => onDragStart(e, job)}
                            onDragEnd={onDragEnd}
                            onClick={() => openJob(job.id)}
                            title="Drag to another day · click to open"
                            className={cn(
                              'block w-full cursor-grab rounded-lg p-1.5 text-left text-[11px] leading-tight transition active:cursor-grabbing',
                              high
                                ? 'bg-red-100 text-red-900'
                                : 'bg-brand-100 text-brand-950',
                              isSource && 'opacity-40',
                              // Keep the dragged chip receiving events; others pass through to the day cell
                              dragging && !isSource && 'pointer-events-none',
                              dragging && isSource && 'pointer-events-auto'
                            )}
                          >
                            <p className="truncate font-semibold">
                              {job.customer_name || 'Customer'}
                            </p>
                            {view === 'week' && (
                              <>
                                <p className="truncate opacity-80">
                                  {job.job_type || 'Job'}
                                  {time ? ` · ${time}` : ''}
                                </p>
                                <p className="truncate opacity-70">
                                  {job.assigned_to_name?.split(' ')[0] ||
                                    'Unassigned'}
                                </p>
                              </>
                            )}
                            {view === 'month' && time ? (
                              <p className="truncate opacity-80">{time}</p>
                            ) : null}
                          </button>
                        );
                      })}
                      {overflow > 0 && (
                        <Link
                          href={hrefFor('week', {
                            week: weekOffsetForDateKey(key),
                            date: key,
                          })}
                          className="block px-1 text-[10px] font-medium text-ink-500 hover:text-ink-800"
                        >
                          +{overflow} more
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
