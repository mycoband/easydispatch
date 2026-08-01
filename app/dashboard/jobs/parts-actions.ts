'use server';

import { revalidatePath } from 'next/cache';
import { isOfficeRole, requireProfile } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import {
  PART_ORDER_STATUSES,
  type PartOrderStatus,
} from '@/lib/jobs/part-orders';

export type PartsActionState = { error?: string; success?: string };

/** Office, or the tech assigned to the job (same pattern as tech/actions loadAssignedJob). */
async function loadAssignedJob(jobId: string) {
  const { supabase, user, profile } = await requireProfile();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, assigned_to')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) throw new Error(error?.message || 'Job not found');

  const office = isOfficeRole(profile.role);
  if (!office && job.assigned_to !== user.id) {
    throw new Error('You are not assigned to this job');
  }

  return { supabase, user, profile, job };
}

function revalidatePartsPaths(jobId: string) {
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath(`/tech/jobs/${jobId}`);
}

function missingTableError(error: { message: string; code?: string }) {
  return error.code === '42P01' || error.message.includes('job_part_orders')
    ? 'Run supabase/competitive-features.sql in Supabase first'
    : error.message;
}

export async function createPartOrder(
  jobId: string,
  input: {
    description: string;
    sku?: string;
    vendor?: string;
    qty?: number;
    unit_cost?: number;
    eta_date?: string;
    notes?: string;
  }
): Promise<PartsActionState> {
  try {
    const perm = await assertTechCapability('part_orders');
    if (!perm.ok) return { error: perm.error };
    const { supabase, user } = await loadAssignedJob(jobId);

    const description = input.description?.trim();
    if (!description) return { error: 'Description required' };

    const { error } = await supabase.from('job_part_orders').insert({
      job_id: jobId,
      description,
      sku: input.sku?.trim() || null,
      vendor: input.vendor?.trim() || null,
      qty: input.qty && input.qty > 0 ? input.qty : 1,
      unit_cost: input.unit_cost ?? 0,
      status: 'needed',
      eta_date: input.eta_date || null,
      notes: input.notes?.trim() || null,
      created_by: user.id,
    });

    if (error) return { error: missingTableError(error) };

    revalidatePartsPaths(jobId);
    return { success: 'Part order added' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Add failed' };
  }
}

export async function updatePartOrder(
  jobId: string,
  orderId: string,
  input: {
    description: string;
    sku?: string;
    vendor?: string;
    qty?: number;
    unit_cost?: number;
    eta_date?: string;
    notes?: string;
  }
): Promise<PartsActionState> {
  try {
    const { supabase } = await loadAssignedJob(jobId);

    const description = input.description?.trim();
    if (!description) return { error: 'Description required' };

    const { error } = await supabase
      .from('job_part_orders')
      .update({
        description,
        sku: input.sku?.trim() || null,
        vendor: input.vendor?.trim() || null,
        qty: input.qty && input.qty > 0 ? input.qty : 1,
        unit_cost: input.unit_cost ?? 0,
        eta_date: input.eta_date || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('job_id', jobId);

    if (error) return { error: missingTableError(error) };

    revalidatePartsPaths(jobId);
    return { success: 'Part order updated' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' };
  }
}

export async function updatePartOrderStatus(
  jobId: string,
  orderId: string,
  status: PartOrderStatus
): Promise<PartsActionState> {
  try {
    const perm = await assertTechCapability('part_orders');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);

    if (!PART_ORDER_STATUSES.includes(status)) {
      return { error: 'Invalid status' };
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'ordered') patch.ordered_at = new Date().toISOString();
    if (status === 'received') patch.received_at = new Date().toISOString();

    const { error } = await supabase
      .from('job_part_orders')
      .update(patch)
      .eq('id', orderId)
      .eq('job_id', jobId);

    if (error) return { error: missingTableError(error) };

    revalidatePartsPaths(jobId);
    return { success: `Marked ${status}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' };
  }
}

export async function deletePartOrder(
  jobId: string,
  orderId: string
): Promise<PartsActionState> {
  try {
    const { supabase } = await loadAssignedJob(jobId);

    const { error } = await supabase
      .from('job_part_orders')
      .delete()
      .eq('id', orderId)
      .eq('job_id', jobId);

    if (error) return { error: missingTableError(error) };

    revalidatePartsPaths(jobId);
    return { success: 'Part order removed' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed' };
  }
}
