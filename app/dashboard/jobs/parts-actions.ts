'use server';

import { revalidatePath } from 'next/cache';
import { isOfficeRole, requireProfile } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import {
  PART_ORDER_STATUSES,
  type PartOrderStatus,
} from '@/lib/jobs/part-orders';
import { createServiceClient } from '@/lib/supabase/admin';

export type PartsActionState = {
  error?: string;
  success?: string;
  attachmentId?: string;
};

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
  revalidatePath('/dashboard/parts');
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

/** Upload a pick ticket photo linked to this job #. */
export async function uploadPickTicketAttachment(
  jobId: string,
  formData: FormData
): Promise<PartsActionState> {
  try {
    const perm = await assertTechCapability('part_orders');
    if (!perm.ok) return { error: perm.error };
    const { user } = await loadAssignedJob(jobId);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { error: 'Photo required' };
    }
    if (!file.type.startsWith('image/')) {
      return { error: 'File must be an image' };
    }
    if (file.size > 12 * 1024 * 1024) {
      return { error: 'Image too large (max 12MB)' };
    }

    const admin = createServiceClient();
    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const fileName = `${jobId}/pick-ticket-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('job-media')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });
    if (uploadError) {
      return {
        error: `Upload failed: ${uploadError.message}. Confirm job-media bucket exists.`,
      };
    }

    const { data: urlData } = admin.storage
      .from('job-media')
      .getPublicUrl(fileName);

    const { data: jobRow } = await admin
      .from('jobs')
      .select('company_id')
      .eq('id', jobId)
      .maybeSingle();
    let companyId = (jobRow?.company_id as string | null) || null;
    if (!companyId) {
      const { data: prof } = await admin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      companyId = prof?.company_id ?? null;
    }

    const { data: row, error } = await admin
      .from('job_attachments')
      .insert({
        job_id: jobId,
        kind: 'photo',
        tag: 'pick_ticket',
        url: urlData.publicUrl,
        caption: 'Pick ticket',
        created_by: user.id,
        ...(companyId ? { company_id: companyId } : {}),
      })
      .select('id')
      .single();

    if (error) return { error: error.message };
    revalidatePartsPaths(jobId);
    return {
      success: 'Pick ticket uploaded',
      attachmentId: row?.id,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

export async function deletePickTicketAttachment(
  jobId: string,
  attachmentId: string
): Promise<PartsActionState> {
  try {
    const perm = await assertTechCapability('part_orders');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);

    const { error } = await supabase
      .from('job_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('job_id', jobId)
      .eq('tag', 'pick_ticket');

    if (error) return { error: error.message };
    revalidatePartsPaths(jobId);
    return { success: 'Pick ticket removed' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed' };
  }
}

/** Create part orders on this job from reviewed pick-ticket lines. */
export async function applyPickTicketLines(
  jobId: string,
  attachmentId: string,
  lines: {
    description: string;
    sku?: string | null;
    qty?: number | null;
    unit_cost?: number | null;
    vendor?: string | null;
  }[]
): Promise<PartsActionState> {
  try {
    const perm = await assertTechCapability('part_orders');
    if (!perm.ok) return { error: perm.error };
    const { supabase, user } = await loadAssignedJob(jobId);

    if (!lines?.length) return { error: 'No lines to add' };

    const { data: attachment } = await supabase
      .from('job_attachments')
      .select('id, tag')
      .eq('id', attachmentId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (!attachment || attachment.tag !== 'pick_ticket') {
      return { error: 'Pick ticket not found on this job' };
    }

    const rows: {
      job_id: string;
      description: string;
      sku: string | null;
      vendor: string | null;
      qty: number;
      unit_cost: number;
      status: 'received';
      received_at: string;
      notes: string;
      created_by: string;
    }[] = [];
    for (const line of lines) {
      const description = line.description?.trim();
      if (!description) continue;
      rows.push({
        job_id: jobId,
        description,
        sku: line.sku?.trim() || null,
        vendor: line.vendor?.trim() || null,
        qty: line.qty && line.qty > 0 ? line.qty : 1,
        unit_cost:
          line.unit_cost === null || line.unit_cost === undefined
            ? 0
            : Number(line.unit_cost) || 0,
        status: 'received',
        received_at: new Date().toISOString(),
        notes: 'From pick ticket',
        created_by: user.id,
      });
    }

    if (!rows.length) return { error: 'No valid lines' };

    const { error } = await supabase.from('job_part_orders').insert(rows);
    if (error) return { error: missingTableError(error) };

    revalidatePartsPaths(jobId);
    return {
      success: `Added ${rows.length} part${rows.length === 1 ? '' : 's'} to this job`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Apply failed' };
  }
}
