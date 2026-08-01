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
  deriveLiveStatus,
  formatTimestamp,
  type LiveStatus,
} from '@/lib/jobs/time-tracking';
import { toDatetimeLocalValue } from '@/lib/jobs/totals';
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
}: {
  jobs: DispatchJob[];
  techs: DispatchTech[];
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

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

  const columns = useMemo(() => {
    const unassigned = filtered
      .filter((j) => !j.assigned_to)
      .sort(sortJobs);
    const techCols = techs.map((tech) => ({
      tech,
      jobs: filtered
        .filter((j) => j.assigned_to === tech.id)
        .sort(sortJobs),
    }));
    return { unassigned, techCols };
  }, [filtered, techs]);

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
            : 'border-ink-200 bg-ink-50/80',
          busy && 'opacity-60'
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-1">
          <span className="font-mono text-[10px] text-ink-400">
            {job.job_number || job.id.slice(0, 8)}
          </span>
          <LiveStatusBadge status={live} />
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
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || 'Tech'}
                </option>
              ))}
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
    subtitle?: string
  ) {
    const active = columnJobs.filter(
      (j) => j.status !== 'Completed' && j.status !== 'Cancelled'
    ).length;

    return (
      <section
        key={key}
        className={cn(
          'flex min-h-[360px] flex-col rounded-2xl border border-ink-100 bg-white p-4',
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
              <p className="text-[10px] text-brand-700">{subtitle}</p>
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
          </p>
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
        {columns.techCols.map(({ tech, jobs: techJobs }) =>
          renderColumn(
            tech.id,
            tech.full_name || 'Tech',
            techJobs,
            'Field tech'
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
