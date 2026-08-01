'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/admin';

export type ConfirmActionState = {
  error?: string;
  success?: string;
};

export async function confirmAppointment(
  token: string
): Promise<ConfirmActionState> {
  try {
    const admin = createServiceClient();
    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (!job) return { error: 'Appointment not found' };

    const { error } = await admin
      .from('jobs')
      .update({
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) return { error: error.message };

    revalidatePath(`/confirm/${token}`);
    revalidatePath(`/dashboard/jobs/${job.id}`);
    return { success: 'Appointment confirmed — thank you!' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not confirm appointment',
    };
  }
}

export async function requestReschedule(
  token: string,
  note: string
): Promise<ConfirmActionState> {
  try {
    const admin = createServiceClient();
    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (!job) return { error: 'Appointment not found' };

    const { error } = await admin
      .from('jobs')
      .update({
        confirmation_status: 'reschedule_requested',
        reschedule_note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) return { error: error.message };

    revalidatePath(`/confirm/${token}`);
    revalidatePath(`/dashboard/jobs/${job.id}`);
    return { success: 'Reschedule request sent — we will reach out shortly.' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not request reschedule',
    };
  }
}
