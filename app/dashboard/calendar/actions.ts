'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import {
  rescheduleIsoToDateKey,
  scheduleIsoOnDate,
  scheduledLocalDateKey,
} from '@/lib/calendar/week';

export type MoveJobResult = { error?: string; success?: string };

function revalidateSchedule(jobId: string) {
  revalidatePath('/dashboard/calendar');
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard/dispatch');
  revalidatePath('/dashboard/day-sheet');
  revalidatePath(`/dashboard/jobs/${jobId}`);
}

/** Move a job’s scheduled date; keeps the existing local time of day. */
export async function moveJobToDate(
  jobId: string,
  dateKey: string
): Promise<MoveJobResult> {
  if (!jobId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { error: 'Invalid job or date' };
  }

  const { supabase } = await requireOffice();

  const { data: job, error: loadError } = await supabase
    .from('jobs')
    .select('id, scheduled_start, status, est_hours')
    .eq('id', jobId)
    .maybeSingle();

  if (loadError || !job) {
    return { error: loadError?.message || 'Job not found' };
  }

  const nextIso = rescheduleIsoToDateKey(job.scheduled_start, dateKey);
  if (!nextIso) return { error: 'Could not build new schedule time' };

  const patch: Record<string, unknown> = {
    scheduled_start: nextIso,
    updated_at: new Date().toISOString(),
  };
  if (job.status === 'New') patch.status = 'Scheduled';

  const built = scheduleIsoOnDate(
    dateKey,
    // keep time from nextIso
    (() => {
      const d = new Date(nextIso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    })(),
    job.est_hours
  );
  if (built?.end) patch.scheduled_end = built.end;

  const { error } = await supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return { error: error.message };

  revalidateSchedule(jobId);
  return { success: 'Moved' };
}

/** Update start time and/or estimated duration on a scheduled job. */
export async function updateJobSchedule(
  jobId: string,
  opts: {
    dateKey?: string;
    timeHm: string;
    estHours?: number | null;
  }
): Promise<MoveJobResult> {
  if (!jobId || !opts.timeHm) {
    return { error: 'Invalid schedule' };
  }

  const { supabase } = await requireOffice();
  const { data: job, error: loadError } = await supabase
    .from('jobs')
    .select('id, scheduled_start, status, est_hours')
    .eq('id', jobId)
    .maybeSingle();

  if (loadError || !job) {
    return { error: loadError?.message || 'Job not found' };
  }

  const dateKey =
    opts.dateKey ||
    scheduledLocalDateKey(job.scheduled_start) ||
    '';
  if (!dateKey) return { error: 'Job has no schedule date' };

  const est =
    opts.estHours === undefined
      ? job.est_hours
      : opts.estHours;

  const built = scheduleIsoOnDate(dateKey, opts.timeHm, est);
  if (!built) return { error: 'Invalid time' };

  const patch: Record<string, unknown> = {
    scheduled_start: built.start,
    scheduled_end: built.end,
    updated_at: new Date().toISOString(),
  };
  if (opts.estHours !== undefined) {
    patch.est_hours = opts.estHours;
  }
  if (job.status === 'New') patch.status = 'Scheduled';

  const { error } = await supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return { error: error.message };

  revalidateSchedule(jobId);
  return { success: 'Schedule updated' };
}
