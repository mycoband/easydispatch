'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import { hoursBetween } from '@/lib/jobs/time-tracking';

export type TimeActionState = {
  error?: string;
  success?: string;
};

type TimeAction = 'drive' | 'arrive' | 'clock_out';

async function assertCanTrackJob(jobId: string) {
  const { supabase, user, profile } = await requireProfile();

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, status, assigned_to, drive_started_at, check_in_at, check_out_at, payment_status'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error(error?.message || 'Job not found');
  }

  const office = isOfficeRole(profile.role);
  const assignedTech = job.assigned_to === user.id;

  if (!office && !assignedTech) {
    throw new Error('You are not assigned to this job');
  }

  return { supabase, user, job, office };
}

async function saveTechLastLocation(
  supabase: Awaited<ReturnType<typeof requireProfile>>['supabase'],
  userId: string,
  coords?: { lat?: number; lng?: number }
) {
  const hasLat = typeof coords?.lat === 'number' && Number.isFinite(coords.lat);
  const hasLng = typeof coords?.lng === 'number' && Number.isFinite(coords.lng);
  if (!hasLat || !hasLng) return;
  const { error } = await supabase
    .from('profiles')
    .update({
      last_lat: coords!.lat,
      last_lng: coords!.lng,
      last_location_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  // Column may be missing until differentiation.sql — ignore
  if (error && !/last_lat|last_lng|last_location|column|schema cache/i.test(error.message)) {
    console.warn('last location:', error.message);
  }
}

function revalidateJob(jobId: string) {
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath('/dashboard/jobs');
  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath('/tech');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/dispatch');
}

export async function trackJobTime(
  jobId: string,
  action: TimeAction,
  coords?: { lat?: number; lng?: number }
): Promise<TimeActionState> {
  try {
    const perm = await assertTechCapability('time_track');
    if (!perm.ok) return { error: perm.error };
    const { supabase, user, job } = await assertCanTrackJob(jobId);
    const now = new Date().toISOString();

    if (action === 'drive') {
      if (job.drive_started_at) {
        return { error: 'Drive already started' };
      }
      if (job.check_out_at) {
        return { error: 'Job already clocked out' };
      }
      const { error } = await supabase
        .from('jobs')
        .update({
          drive_started_at: now,
          // Keep Scheduled/New until Arrive puts it In Progress
          updated_at: now,
        })
        .eq('id', jobId);
      if (error) return { error: error.message };
      await saveTechLastLocation(supabase, user.id, coords);
      revalidateJob(jobId);
      return { success: 'Drive started' };
    }

    if (action === 'arrive') {
      if (job.check_in_at) {
        return { error: 'Already arrived / started work' };
      }
      if (job.check_out_at) {
        return { error: 'Job already clocked out' };
      }
      const hasLat = typeof coords?.lat === 'number' && Number.isFinite(coords.lat);
      const hasLng = typeof coords?.lng === 'number' && Number.isFinite(coords.lng);
      const { error } = await supabase
        .from('jobs')
        .update({
          drive_started_at: job.drive_started_at || now,
          check_in_at: now,
          check_in_lat: hasLat ? coords!.lat : null,
          check_in_lng: hasLng ? coords!.lng : null,
          status: 'In Progress',
          updated_at: now,
        })
        .eq('id', jobId);
      if (error) return { error: error.message };
      await saveTechLastLocation(supabase, user.id, coords);
      revalidateJob(jobId);
      return { success: 'Arrived / work started' };
    }

    // clock_out
    if (job.check_out_at) {
      return { error: 'Already clocked out' };
    }
    if (!job.check_in_at && !job.drive_started_at) {
      return { error: 'Start Drive or Arrive before clocking out' };
    }

    const checkIn = job.check_in_at || now;
    const actualHours = hoursBetween(checkIn, now);

    const { error } = await supabase
      .from('jobs')
      .update({
        drive_started_at: job.drive_started_at || checkIn,
        check_in_at: checkIn,
        check_out_at: now,
        actual_hours: actualHours,
        status: 'Completed',
        updated_at: now,
      })
      .eq('id', jobId);

    if (error) return { error: error.message };
    try {
      const { recalculateJobCosting } = await import(
        '@/lib/jobs/recalculate-costing'
      );
      await recalculateJobCosting(supabase, jobId);
    } catch {
      /* optional until job-costing.sql */
    }
    if (job.payment_status === 'Paid') {
      try {
        const { maybeSendReviewAsk } = await import('@/lib/reviews/ask');
        await maybeSendReviewAsk(jobId);
      } catch {
        /* optional */
      }
    }
    revalidateJob(jobId);
    return { success: 'Clocked out' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Time tracking failed',
    };
  }
}
