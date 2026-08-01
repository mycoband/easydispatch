'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { rescheduleIsoToDateKey } from '@/lib/calendar/week';

export type MoveJobResult = { error?: string; success?: string };

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
    .select('id, scheduled_start, status')
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

  const { error } = await supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/calendar');
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard/dispatch');
  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { success: 'Moved' };
}
