'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { fromDatetimeLocalValue } from '@/lib/jobs/totals';

export type DispatchActionState = {
  error?: string;
  success?: string;
};

function revalidateDispatch() {
  revalidatePath('/dashboard/dispatch');
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard');
  revalidatePath('/tech');
}

async function resolveAssignee(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  assignedTo: string | null
) {
  if (!assignedTo) return { assigned_to: null, assigned_to_name: null };
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', assignedTo)
    .maybeSingle();
  if (!data) throw new Error('Technician not found');
  return {
    assigned_to: data.id,
    assigned_to_name: data.full_name ?? null,
  };
}

/** Assign / unassign a job from the dispatch board (drag or reassign dropdown). */
export async function assignDispatchJob(
  jobId: string,
  assignedTo: string | null
): Promise<DispatchActionState> {
  try {
    const { supabase } = await requireOffice();

    const { data: job, error: loadError } = await supabase
      .from('jobs')
      .select('id, status, drive_started_at, check_in_at, check_out_at')
      .eq('id', jobId)
      .maybeSingle();

    if (loadError || !job) {
      return { error: loadError?.message || 'Job not found' };
    }

    const assignee = await resolveAssignee(supabase, assignedTo);
    const now = new Date().toISOString();

    let status = job.status;
    if (!assignee.assigned_to) {
      if (
        status === 'Scheduled' &&
        !job.drive_started_at &&
        !job.check_in_at &&
        !job.check_out_at
      ) {
        status = 'New';
      }
    } else if (status === 'New') {
      status = 'Scheduled';
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        assigned_to: assignee.assigned_to,
        assigned_to_name: assignee.assigned_to_name,
        status,
        updated_at: now,
      })
      .eq('id', jobId);

    if (error) return { error: error.message };

    revalidateDispatch();
    revalidatePath(`/dashboard/jobs/${jobId}`);
    if (assignee.assigned_to) {
      revalidatePath(`/tech/jobs/${jobId}`);
    }
    return {
      success: assignee.assigned_to
        ? `Assigned to ${assignee.assigned_to_name || 'tech'}`
        : 'Moved to Unassigned',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Assign failed',
    };
  }
}

/** Set or clear scheduled start from a dispatch card. */
export async function setDispatchJobTime(
  jobId: string,
  scheduledStartLocal: string
): Promise<DispatchActionState> {
  try {
    const { supabase } = await requireOffice();

    const { data: job, error: loadError } = await supabase
      .from('jobs')
      .select('id, status, assigned_to')
      .eq('id', jobId)
      .maybeSingle();

    if (loadError || !job) {
      return { error: loadError?.message || 'Job not found' };
    }

    const scheduled_start = fromDatetimeLocalValue(scheduledStartLocal);
    const now = new Date().toISOString();
    let status = job.status;

    if (scheduled_start && job.assigned_to && status === 'New') {
      status = 'Scheduled';
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        scheduled_start,
        status,
        updated_at: now,
      })
      .eq('id', jobId);

    if (error) return { error: error.message };

    revalidateDispatch();
    revalidatePath(`/dashboard/jobs/${jobId}`);
    return {
      success: scheduled_start ? 'Time updated' : 'Time cleared',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Set time failed',
    };
  }
}
