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
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { isSameMonth } from 'date-fns';
import {
  moveJobToDate,
  updateJobSchedule,
} from '@/app/dashboard/calendar/actions';
import { CalendarDateJump } from '@/components/calendar/CalendarDateJump';
import {
  type CalendarView,
  isToday,
  localDateKey,
  localTimeHm,
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
  est_hours?: number | null;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DRAG_MIME = 'application/x-easydispatch-job';
const TOUCH_DRAG_THRESHOLD_PX = 10;

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

function dateKeyFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest('[data-cal-day]') as HTMLElement | null;
  return cell?.dataset.calDay || null;
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
  const [touchGhost, setTouchGhost] = useState<{
    label: string;
    high: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('09:00');
  const [editHours, setEditHours] = useState('');
  const dragMoved = useRef(false);
  const dragOverDateRef = useRef<string | null>(null);
  const touchDragRef = useRef<{
    jobId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    label: string;
    high: boolean;
  } | null>(null);

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

  function setDropTarget(dateKey: string | null) {
    dragOverDateRef.current = dateKey;
    setDragOverDate(dateKey);
  }

  function commitMove(jobId: string, dateKey: string) {
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
    setDropTarget(null);
  }

  function onDragOverDay(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDateRef.current !== dateKey) setDropTarget(dateKey);
  }

  function onDragEnterDay(e: DragEvent, dateKey: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(dateKey);
  }

  /** Ignore leave events that are just moving into a child (label, +, job chip). */
  function onDragLeaveDay(e: DragEvent, dateKey: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (dragOverDateRef.current === dateKey) setDropTarget(null);
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
    setDropTarget(null);
    setDraggingId(null);
    if (!jobId) return;
    commitMove(jobId, dateKey);
  }

  /** iOS/Safari: HTML5 drag is unreliable — use pointer drag for touch/pen. */
  function onJobPointerDown(e: ReactPointerEvent, job: CalendarJob) {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    const high = job.priority === 'High' || job.priority === 'Emergency';
    touchDragRef.current = {
      jobId: job.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      label: job.customer_name || 'Customer',
      high,
    };
    setError(null);
  }

  function onJobPointerMove(e: ReactPointerEvent) {
    const pd = touchDragRef.current;
    if (!pd || pd.pointerId !== e.pointerId) return;

    const dx = e.clientX - pd.startX;
    const dy = e.clientY - pd.startY;
    if (!pd.active) {
      if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return;
      pd.active = true;
      dragMoved.current = false;
      setDraggingId(pd.jobId);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    e.preventDefault();
    setTouchGhost({
      label: pd.label,
      high: pd.high,
      x: e.clientX,
      y: e.clientY,
    });
    setDropTarget(dateKeyFromPoint(e.clientX, e.clientY));
  }

  function endTouchDrag(e: ReactPointerEvent, job: CalendarJob) {
    const pd = touchDragRef.current;
    touchDragRef.current = null;
    setTouchGhost(null);
    if (!pd || pd.pointerId !== e.pointerId) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (!pd.active) {
      openScheduleEditor(job);
      return;
    }

    const dateKey =
      dragOverDateRef.current || dateKeyFromPoint(e.clientX, e.clientY);
    setDraggingId(null);
    setDropTarget(null);
    if (dateKey) commitMove(pd.jobId, dateKey);
  }

  function openScheduleEditor(job: CalendarJob) {
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    setEditingId(job.id);
    setEditTime(localTimeHm(job.scheduled_start));
    setEditHours(
      job.est_hours != null && Number(job.est_hours) > 0
        ? String(job.est_hours)
        : ''
    );
    setError(null);
  }

  function saveSchedule() {
    if (!editingId) return;
    const jobId = editingId;
    const job = localJobs.find((j) => j.id === jobId);
    const dateKey = scheduledLocalDateKey(job?.scheduled_start);
    if (!dateKey) {
      setError('Job has no date');
      return;
    }
    const hoursRaw = editHours.trim();
    const estHours = hoursRaw === '' ? null : Number(hoursRaw);
    if (hoursRaw !== '' && (!Number.isFinite(estHours) || (estHours ?? 0) < 0)) {
      setError('Invalid duration hours');
      return;
    }

    const snapshot = localJobs;
    const timeHm = editTime;
    const [hh, mm] = timeHm.split(':').map(Number);
    const [y, mo, d] = dateKey.split('-').map(Number);
    const nextStart = new Date(
      y,
      mo - 1,
      d,
      hh || 0,
      mm || 0,
      0,
      0
    ).toISOString();
    setLocalJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              scheduled_start: nextStart,
              est_hours: estHours,
              status: j.status === 'New' ? 'Scheduled' : j.status,
            }
          : j
      )
    );
    setEditingId(null);

    startTransition(async () => {
      const result = await updateJobSchedule(jobId, {
        dateKey,
        timeHm,
        estHours,
      });
      if (result.error) {
        setLocalJobs(snapshot);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const editingJob = editingId
    ? localJobs.find((j) => j.id === editingId) || null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Drag a job to another day · tap/click to edit start time &amp;
            duration
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
          {error}
        </p>
      )}
      {pending && (
        <p className="text-xs font-medium text-ink-400">Saving schedule…</p>
      )}

      {editingJob && (
        <div className="panel space-y-3 border-brand-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-ink-900">
                {editingJob.customer_name || 'Customer'}
              </p>
              <p className="text-xs text-ink-500">
                {editingJob.job_type || 'Job'}
                {editingJob.job_number ? ` · ${editingJob.job_number}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-sm text-ink-500 hover:text-ink-800"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">
                Start time
              </span>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">
                Duration (hours)
              </span>
              <input
                type="number"
                step="0.25"
                min="0"
                placeholder="e.g. 1.5"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                className="w-28 rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={saveSchedule}
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Save
            </button>
            <Link
              href={`/dashboard/jobs/${editingJob.id}`}
              className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Open job
            </Link>
          </div>
        </div>
      )}

      {/* Same 7-day board on phone and desktop; scroll sideways on small screens */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/80 text-xs font-semibold text-ink-500">
              {DAY_NAMES.map((name) => (
                <div key={name} className="p-3 text-center">
                  {name}
                </div>
              ))}
            </div>
            <div
              className={cn(
                'grid grid-cols-7',
                view === 'month' && 'auto-rows-fr'
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
                    data-cal-day={key}
                    onDragEnter={(e) => onDragEnterDay(e, key)}
                    onDragOver={(e) => onDragOverDay(e, key)}
                    onDragLeave={(e) => onDragLeaveDay(e, key)}
                    onDrop={(e) => onDropDay(e, key)}
                    className={cn(
                      'relative flex flex-col border-b border-r border-ink-100 p-2 last:border-r-0',
                      view === 'month' ? 'min-h-[120px]' : 'min-h-[140px]',
                      !inMonth && 'bg-ink-50/60',
                      inMonth && today && 'bg-brand-50/40',
                      inMonth && highlighted && !today && 'bg-amber-50/50',
                      inMonth && !today && !highlighted && 'bg-white',
                      isDropTarget &&
                        'bg-brand-50 ring-2 ring-inset ring-brand-500'
                    )}
                  >
                    {/*
                      While dragging, disable pointer events on labels/links/chips
                      so the whole cell stays a drop target. Source chip stays
                      interactive so HTML5 / touch drag continues.
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
                              ? new Date(
                                  job.scheduled_start
                                ).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : '';
                            const isSource = draggingId === job.id;
                            return (
                              <button
                                key={job.id}
                                type="button"
                                draggable
                                onDragStart={(e) => onDragStart(e, job)}
                                onDragEnd={onDragEnd}
                                onPointerDown={(e) => onJobPointerDown(e, job)}
                                onPointerMove={onJobPointerMove}
                                onPointerUp={(e) => endTouchDrag(e, job)}
                                onPointerCancel={(e) => endTouchDrag(e, job)}
                                onClick={() => {
                                  // Touch opens editor on pointerup (tap). Mouse uses click.
                                  // Skip when a drag just finished (dragMoved).
                                  if (touchDragRef.current) return;
                                  openScheduleEditor(job);
                                }}
                                title="Drag to another day · tap/click to edit time"
                                className={cn(
                                  'block w-full cursor-grab touch-none rounded-lg p-1.5 text-left text-[11px] leading-tight transition active:cursor-grabbing',
                                  high
                                    ? 'bg-red-100 text-red-900'
                                    : 'bg-brand-100 text-brand-950',
                                  isSource && 'opacity-40',
                                  dragging &&
                                    !isSource &&
                                    'pointer-events-none',
                                  dragging &&
                                    isSource &&
                                    'pointer-events-auto'
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
      </div>

      {touchGhost && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none fixed z-[80] w-36 -translate-x-1/2 -translate-y-full rounded-lg p-1.5 text-left text-[11px] shadow-lg ring-2 ring-brand-500',
            touchGhost.high
              ? 'bg-red-100 text-red-900'
              : 'bg-brand-100 text-brand-950'
          )}
          style={{ left: touchGhost.x, top: touchGhost.y - 8 }}
        >
          <p className="truncate font-semibold">{touchGhost.label}</p>
          <p className="opacity-70">Drop on a day</p>
        </div>
      )}
    </div>
  );
}
