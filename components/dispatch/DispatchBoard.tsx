'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  assignDispatchJob,
  setDispatchJobTime,
} from '@/app/dashboard/dispatch/actions';
import { DispatchMessageButtons } from '@/components/dispatch/DispatchMessageButtons';
import { DispatchOfficeTools } from '@/components/dispatch/DispatchOfficeTools';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import type { DispatchJob, DispatchTech } from '@/lib/dispatch/types';
import {
  DAY_CAPACITY_HOURS,
  findOverlappingJobIds,
  isOverloaded,
} from '@/lib/dispatch/capacity';
import { mergeRealtimeJob } from '@/lib/dispatch/merge-realtime-job';
import {
  buildDayLoad,
  suggestTechsForJob,
} from '@/lib/dispatch/suggest';
import { localDateKey } from '@/lib/calendar/week';
import {
  deriveLiveStatus,
  formatTimestamp,
  type LiveStatus,
} from '@/lib/jobs/time-tracking';
import { toDatetimeLocalValue } from '@/lib/jobs/totals';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'unassigned', label: 'New / Unassigned' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
] as const;

function sortJobs(a: DispatchJob, b: DispatchJob) {
  const highA = a.priority === 'High' || a.priority === 'Emergency';
  const highB = b.priority === 'High' || b.priority === 'Emergency';
  if (highA && !highB) return -1;
  if (highB && !highA) return 1;
  const ta = a.scheduled_start
    ? new Date(a.scheduled_start).getTime()
    : Number.MAX_SAFE_INTEGER;
  const tb = b.scheduled_start
    ? new Date(b.scheduled_start).getTime()
    : Number.MAX_SAFE_INTEGER;
  return ta - tb;
}

export function DispatchBoard({
  jobs: initialJobs,
  techs,
  skillAware = false,
  liveRealtime = false,
  capacityWarnings = false,
}: {
  jobs: DispatchJob[];
  techs: DispatchTech[];
  skillAware?: boolean;
  liveRealtime?: boolean;
  capacityWarnings?: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [liveState, setLiveState] = useState<'off' | 'connecting' | 'live' | 'error'>(
    liveRealtime ? 'connecting' : 'off'
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (!liveRealtime) {
      setLiveState('off');
      return;
    }
    setLiveState('connecting');
    const supabase = createClient();
    const channel = supabase
      .channel('dispatch-jobs-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id;
            if (oldId) {
              setJobs((prev) => prev.filter((j) => j.id !== oldId));
            }
            return;
          }
          const row = payload.new as Record<string, unknown> | null;
          if (!row?.id) return;
          setJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === row.id);
            const merged = mergeRealtimeJob(
              idx >= 0 ? prev[idx] : undefined,
              row
            );
            if (!merged) {
              return idx >= 0 ? prev.filter((j) => j.id !== row.id) : prev;
            }
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = merged;
              return next;
            }
            // New job appeared — keep list lean; refresh for customer phone/address
            return [merged, ...prev].slice(0, 220);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLiveState('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveState('error');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveRealtime]);

  const summary = useMemo(() => {
    const unassigned = jobs.filter((j) => !j.assigned_to).length;
    const enRoute = jobs.filter(
      (j) => deriveLiveStatus(j) === 'En Route'
    ).length;
    const onSite = jobs.filter((j) => deriveLiveStatus(j) === 'On Site').length;
    return { unassigned, enRoute, onSite };
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter === 'unassigned') {
        if (job.assigned_to && job.status !== 'New') return false;
      } else if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (job.customer_name || '').toLowerCase().includes(q) ||
        (job.job_number || '').toLowerCase().includes(q) ||
        (job.job_type || '').toLowerCase().includes(q) ||
        (job.internal_notes || '').toLowerCase().includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  const dayKey = localDateKey(new Date());
  const dayLoad = useMemo(
    () => buildDayLoad(jobs, dayKey),
    [jobs, dayKey]
  );
  const overlappingIds = useMemo(
    () =>
      capacityWarnings
        ? findOverlappingJobIds(jobs, dayKey)
        : new Set<string>(),
    [jobs, dayKey, capacityWarnings]
  );

  const columns = useMemo(() => {
    const unassigned = filtered
      .filter((j) => !j.assigned_to)
      .sort(sortJobs);
    const techCols = techs.map((tech) => {
      const load = dayLoad.get(tech.id) || { jobCount: 0, hours: 0 };
      const overlapCount = filtered.filter(
        (j) => j.assigned_to === tech.id && overlappingIds.has(j.id)
      ).length;
      return {
        tech,
        jobs: filtered
          .filter((j) => j.assigned_to === tech.id)
          .sort(sortJobs),
        load,
        overloaded: capacityWarnings && isOverloaded(load.hours),
        overlapCount: capacityWarnings ? overlapCount : 0,
      };
    });
    return { unassigned, techCols };
  }, [filtered, techs, dayLoad, capacityWarnings, overlappingIds]);

  function flash(ok?: string, err?: string) {
    setMessage(ok || null);
    setError(err || null);
  }

  function applyAssignLocal(
    jobId: string,
    assignedTo: string | null,
    assignedName: string | null
  ) {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== jobId) return j;
        let status = j.status;
        if (!assignedTo) {
          if (
            status === 'Scheduled' &&
            !j.drive_started_at &&
            !j.check_in_at &&
            !j.check_out_at
          ) {
            status = 'New';
          }
        } else if (status === 'New') {
          status = 'Scheduled';
        }
        return {
          ...j,
          assigned_to: assignedTo,
          assigned_to_name: assignedName,
          status,
        };
      })
    );
  }

  function runAssign(jobId: string, assignedTo: string | null) {
    const tech = techs.find((t) => t.id === assignedTo) || null;
    const prev = jobs.find((j) => j.id === jobId);
    applyAssignLocal(jobId, assignedTo, tech?.full_name ?? null);
    setPendingJobId(jobId);
    flash();
    startTransition(async () => {
      const result = await assignDispatchJob(jobId, assignedTo);
      setPendingJobId(null);
      if (result.error) {
        if (prev) {
          applyAssignLocal(
            jobId,
            prev.assigned_to,
            prev.assigned_to_name
          );
        }
        flash(undefined, result.error);
      } else {
        flash(result.success);
        router.refresh();
      }
    });
  }

  function openSetTime(job: DispatchJob) {
    setTimeEditId(job.id);
    setTimeValue(toDatetimeLocalValue(job.scheduled_start));
  }

  function saveTime(jobId: string) {
    setPendingJobId(jobId);
    flash();
    startTransition(async () => {
      const result = await setDispatchJobTime(jobId, timeValue);
      setPendingJobId(null);
      if (result.error) {
        flash(undefined, result.error);
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  scheduled_start: timeValue
                    ? new Date(timeValue).toISOString()
                    : null,
                }
              : j
          )
        );
        setTimeEditId(null);
        flash(result.success);
        router.refresh();
      }
    });
  }

  function onDropColumn(columnKey: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverCol(null);
      const jobId = e.dataTransfer.getData('text/job-id');
      if (!jobId) return;
      const assignedTo = columnKey === 'unassigned' ? null : columnKey;
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      if ((job.assigned_to || null) === assignedTo) return;
      runAssign(jobId, assignedTo);
    };
  }

  function renderCard(job: DispatchJob) {
    const live = deriveLiveStatus(job) as LiveStatus;
    const high = job.priority === 'High' || job.priority === 'Emergency';
    const busy = pendingJobId === job.id || isPending;
    const suggestions =
      skillAware && !job.assigned_to
        ? suggestTechsForJob(
            {
              job_type: job.job_type,
              est_hours: job.est_hours,
              site_lat: job.site_lat,
              site_lng: job.site_lng,
            },
            techs,
            dayLoad
          ).slice(0, 3)
        : [];
    const best = suggestions[0];
    const orderedTechs =
      skillAware && suggestions.length
        ? [
            ...suggestions.map(
              (s) => techs.find((t) => t.id === s.techId)!
            ).filter(Boolean),
            ...techs.filter(
              (t) => !suggestions.some((s) => s.techId === t.id)
            ),
          ]
        : techs;

    return (
      <article
        key={job.id}
        draggable={!busy}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/job-id', job.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={cn(
          'rounded-xl border p-3 text-xs shadow-sm transition',
          high
            ? 'border-red-300 bg-red-50/60'
            : overlappingIds.has(job.id)
              ? 'border-amber-400 bg-amber-50/70'
              : 'border-ink-200 bg-ink-50/80',
          busy && 'opacity-60'
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-1">
          <span className="font-mono text-[10px] text-ink-400">
            {job.job_number || job.id.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1">
            {overlappingIds.has(job.id) && (
              <span
                className="rounded bg-amber-200 px-1 py-0.5 text-[9px] font-semibold text-amber-950"
                title="Overlaps another job for this tech"
              >
                Overlap
              </span>
            )}
            <LiveStatusBadge status={live} />
          </div>
        </div>
        <p className="text-sm font-semibold leading-tight text-ink-900">
          {job.customer_name || 'Customer'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-brand-700">
          {job.job_type || 'Service'}
        </p>
        {job.phone && (
          <p className="mt-1 truncate text-[11px] text-ink-500">{job.phone}</p>
        )}
        {job.address && (
          <p className="truncate text-[11px] text-ink-400">{job.address}</p>
        )}
        {job.internal_notes && (
          <p
            className="mt-1 truncate rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900"
            title={job.internal_notes}
          >
            {job.internal_notes}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-ink-600">
            {job.scheduled_start
              ? formatTimestamp(job.scheduled_start)
              : 'No time set'}
          </span>
          <span
            className={cn(
              high ? 'font-bold text-red-600' : 'text-ink-500'
            )}
          >
            {job.priority || 'Medium'}
            {job.est_hours != null ? ` · ${job.est_hours}h` : ''}
          </span>
        </div>
        {(job.invoice_status || job.payment_status) && (
          <p className="mt-1 text-[10px] text-ink-500">
            {job.invoice_status || 'Not Sent'}
            {job.payment_status === 'Paid' ? ' · Paid' : ''}
          </p>
        )}

        <div className="mt-2 space-y-1.5 border-t border-ink-200/80 pt-2">
          {best && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  runAssign(job.id, best.techId);
                }}
                className="rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                title={best.reason}
              >
                Assign AI: {best.name.split(' ')[0]}
              </button>
              <span className="text-[10px] text-ink-500">{best.reason}</span>
            </div>
          )}
          <div className="flex gap-1">
            <select
              className="flex-1 rounded-lg border border-ink-200 bg-white px-1.5 py-1 text-[11px]"
              value={job.assigned_to || ''}
              disabled={busy}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                runAssign(job.id, e.target.value || null);
              }}
            >
              <option value="">Unassigned</option>
              {orderedTechs.map((t) => {
                const tip = suggestions.find((s) => s.techId === t.id);
                return (
                  <option key={t.id} value={t.id}>
                    {t.full_name || 'Tech'}
                    {tip ? ` · ${Math.round(tip.skillScore * 100)}%` : ''}
                    {t.skills?.length
                      ? ` (${t.skills.slice(0, 2).join(', ')})`
                      : ''}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px] hover:bg-ink-50"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                openSetTime(job);
              }}
            >
              Set Time
            </button>
          </div>

          {timeEditId === job.id && (
            <div className="flex flex-col gap-1 rounded-lg border border-ink-200 bg-white p-2">
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-ink-200 bg-white px-1.5 py-1 text-[11px]"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveTime(job.id);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-md border border-ink-200 px-2 py-1 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeEditId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div
            className="flex items-start gap-1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-[2]">
              <DispatchMessageButtons jobId={job.id} phone={job.phone} />
            </div>
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className="flex-1 rounded-lg bg-ink-900 py-1.5 text-center text-[11px] font-medium text-white hover:bg-ink-800"
            >
              Open
            </Link>
          </div>
        </div>
      </article>
    );
  }

  function renderColumn(
    key: string,
    title: string,
    columnJobs: DispatchJob[],
    subtitle?: string,
    opts?: { overloaded?: boolean; overlapCount?: number }
  ) {
    const active = columnJobs.filter(
      (j) => j.status !== 'Completed' && j.status !== 'Cancelled'
    ).length;
    const overloaded = Boolean(opts?.overloaded);
    const overlapCount = opts?.overlapCount || 0;

    return (
      <section
        key={key}
        className={cn(
          'flex min-h-[360px] flex-col rounded-2xl border bg-white p-4',
          overloaded
            ? 'border-amber-300 bg-amber-50/40'
            : 'border-ink-100',
          dragOverCol === key && 'ring-2 ring-brand-400'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverCol(key);
        }}
        onDragLeave={() => {
          setDragOverCol((cur) => (cur === key ? null : cur));
        }}
        onDrop={onDropColumn(key)}
      >
        <div className="mb-3 flex items-start justify-between gap-2 px-0.5">
          <div>
            <p className="font-semibold text-ink-800">{title}</p>
            {subtitle && (
              <p
                className={cn(
                  'text-[10px]',
                  overloaded ? 'font-semibold text-amber-800' : 'text-brand-700'
                )}
              >
                {subtitle}
              </p>
            )}
            {overloaded && (
              <p className="text-[10px] font-semibold text-amber-900">
                Overbooked (&gt;{DAY_CAPACITY_HOURS}h)
              </p>
            )}
            {overlapCount > 0 && (
              <p className="text-[10px] font-semibold text-amber-900">
                {overlapCount} overlapping
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
              {columnJobs.length}
            </span>
            {key !== 'unassigned' && (
              <p className="mt-0.5 text-[10px] text-ink-400">
                {active} active
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5">
          {columnJobs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-ink-100 py-10 text-center text-xs text-ink-300">
              Drop jobs here
              <br />
              <span className="text-[10px]">or use Reassign on a card</span>
            </div>
          ) : (
            columnJobs.map(renderCard)
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Dispatch board
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Assign techs · Track status · Message customers
            {skillAware
              ? ' · Assign AI: skills + load + last location'
              : ''}
            {capacityWarnings ? ' · capacity warnings' : ''}
          </p>
          {liveRealtime && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                liveState === 'live'
                  ? 'text-emerald-700'
                  : liveState === 'error'
                    ? 'text-amber-800'
                    : 'text-ink-400'
              )}
            >
              {liveState === 'live'
                ? '● Live — En Route / On Site update automatically'
                : liveState === 'error'
                  ? 'Realtime reconnecting… (run supabase/ops-polish.sql if this persists)'
                  : 'Connecting live updates…'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-40 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Link
            href="/dashboard/jobs/new"
            className="rounded-xl bg-ink-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-ink-800"
          >
            + New job
          </Link>
        </div>
      </div>

      <DispatchOfficeTools summary={summary} />

      {(message || error) && (
        <p
          className={cn(
            'text-sm',
            error ? 'text-red-700' : 'text-emerald-700'
          )}
        >
          {error || message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {renderColumn('unassigned', 'Unassigned', columns.unassigned)}
        {columns.techCols.map(
          ({ tech, jobs: techJobs, load, overloaded, overlapCount }) =>
            renderColumn(
              tech.id,
              tech.full_name || 'Tech',
              techJobs,
              `${load.hours.toFixed(1)}h today${
                skillAware
                  ? ` · ${tech.skills?.slice(0, 3).join(', ') || 'no skills set'}`
                  : ''
              }`,
              { overloaded, overlapCount }
            )
        )}
      </div>

      {techs.length === 0 && (
        <p className="text-sm text-ink-500">
          No technician profiles yet. Create a user with role{' '}
          <span className="font-medium">technician</span> to get a column.
        </p>
      )}
    </div>
  );
}
