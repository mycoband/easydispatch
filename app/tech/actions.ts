'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import { createServiceClient } from '@/lib/supabase/admin';
import {
  SAFETY_CHECKLIST_ITEMS,
  type SafetyChecklistState,
} from '@/lib/tech/safety';

export type TechActionState = { error?: string; success?: string };

async function loadAssignedJob(jobId: string) {
  const { supabase, user, profile } = await requireProfile();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, assigned_to, customer_id, status, safety_checklist')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) throw new Error(error?.message || 'Job not found');

  const office = isOfficeRole(profile.role);
  if (!office && job.assigned_to !== user.id) {
    throw new Error('You are not assigned to this job');
  }

  return { supabase, user, profile, job };
}

function revalidateTechJob(jobId: string) {
  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath('/tech');
}

export async function saveTechJobNotes(
  jobId: string,
  input: {
    diagnosis?: string;
    customer_summary?: string;
    internal_notes?: string;
  }
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('edit_notes');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);
    const { error } = await supabase
      .from('jobs')
      .update({
        diagnosis: input.diagnosis?.trim() || null,
        customer_summary: input.customer_summary?.trim() || null,
        internal_notes: input.internal_notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) return { error: error.message };
    revalidateTechJob(jobId);
    return { success: 'Notes saved' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed' };
  }
}

export async function saveJobSignature(
  jobId: string,
  input: { signatureData: string; signatureName: string }
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('customer_signature');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);
    if (!input.signatureData?.startsWith('data:image')) {
      return { error: 'Signature required' };
    }
    const name = input.signatureName.trim();
    if (!name) return { error: 'Customer name required' };

    const { error } = await supabase
      .from('jobs')
      .update({
        signature_data: input.signatureData,
        signature_name: name,
        signed_at: new Date().toISOString(),
        status: 'Completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) return { error: error.message };
    try {
      const { maybeSendReviewAsk } = await import('@/lib/reviews/ask');
      await maybeSendReviewAsk(jobId);
    } catch {
      /* optional */
    }
    revalidateTechJob(jobId);
    return { success: 'Signed & marked complete' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign failed' };
  }
}

export async function markCustomerApproved(
  jobId: string,
  note?: string
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('media');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);
    const { error } = await supabase
      .from('jobs')
      .update({
        customer_approved_at: new Date().toISOString(),
        customer_approved_note:
          note?.trim() || 'Customer approved verbally',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) return { error: error.message };
    revalidateTechJob(jobId);
    return { success: 'Verbal approval logged' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function saveSafetyChecklist(
  jobId: string,
  checklist: SafetyChecklistState
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('safety');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);
    const allowed = new Set(SAFETY_CHECKLIST_ITEMS.map((i) => i.id));
    const cleaned: SafetyChecklistState = {};
    for (const [key, value] of Object.entries(checklist)) {
      if (!allowed.has(key as keyof SafetyChecklistState)) continue;
      cleaned[key as keyof SafetyChecklistState] = {
        checked: Boolean(value?.checked),
        at: value?.checked ? value.at || new Date().toISOString() : null,
      };
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        safety_checklist: cleaned,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) return { error: error.message };
    revalidateTechJob(jobId);
    return { success: 'Checklist saved' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function uploadJobAttachment(
  jobId: string,
  formData: FormData
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('media');
    if (!perm.ok) return { error: perm.error };
    const { user } = await loadAssignedJob(jobId);
    const file = formData.get('file');
    const kind = String(formData.get('kind') || 'photo');
    const tag = String(formData.get('tag') || 'other');
    const caption = String(formData.get('caption') || '').trim();

    if (!(file instanceof File) || file.size === 0) {
      return { error: 'File required' };
    }
    if (!['photo', 'voice', 'note', 'video'].includes(kind)) {
      return { error: 'Invalid kind' };
    }
    const maxBytes =
      kind === 'video' ? 80 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return {
        error:
          kind === 'video'
            ? 'Video too large (max 80MB — keep clips under ~90 seconds)'
            : 'File too large (max 20MB)',
      };
    }

    const admin = createServiceClient();
    const ext =
      kind === 'voice'
        ? file.type.includes('mp4')
          ? 'mp4'
          : 'webm'
        : kind === 'video'
          ? // Prefer mp4 for Whisper (rejects .mov); iPhone often sends quicktime
            file.type.includes('webm')
              ? 'webm'
              : 'mp4'
          : file.type === 'image/png'
            ? 'png'
            : file.type === 'image/webp'
              ? 'webp'
              : 'jpg';
    const fileName = `${jobId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const contentType =
      kind === 'video'
        ? file.type.includes('webm')
          ? 'video/webm'
          : 'video/mp4'
        : file.type ||
          (kind === 'voice' ? 'audio/webm' : 'image/jpeg');

    const { error: uploadError } = await admin.storage
      .from('job-media')
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: `Upload failed: ${uploadError.message}. Run tech-features.sql and confirm job-media bucket exists.`,
      };
    }

    const { data: urlData } = admin.storage
      .from('job-media')
      .getPublicUrl(fileName);

    // Service-role inserts skip auth.uid() company trigger — set company_id
    // so Job photos RLS can select the row.
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

    const { error } = await admin.from('job_attachments').insert({
      job_id: jobId,
      kind,
      tag,
      url: urlData.publicUrl,
      caption: caption || null,
      created_by: user.id,
      ...(companyId ? { company_id: companyId } : {}),
    });

    if (error) {
      if (/kind|check|video/i.test(error.message)) {
        return {
          error:
            'Video not enabled in database. Run supabase/ai-walkthrough-video.sql (or updated ai-walkthrough.sql) in Supabase.',
        };
      }
      return { error: error.message };
    }
    revalidateTechJob(jobId);
    return {
      success:
        kind === 'voice'
          ? 'Voice note saved'
          : kind === 'video'
            ? 'Video walkthrough saved'
            : 'Photo saved',
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

/**
 * Transcribe a saved voice note → diagnosis / customer summary (Whisper + Grok).
 */
export async function transcribeVoiceToNotes(
  jobId: string,
  attachmentId: string
): Promise<TechActionState> {
  try {
    const mediaPerm = await assertTechCapability('media');
    if (!mediaPerm.ok) return { error: mediaPerm.error };
    const notesPerm = await assertTechCapability('edit_notes');
    if (!notesPerm.ok) return { error: notesPerm.error };

    const { loadCompanySettings } = await import('@/lib/company');
    const company = await loadCompanySettings();
    if (!company.modules.ai) {
      return { error: 'Turn on AI tools in Settings → Feature modules' };
    }
    if (!company.modules.tech_media) {
      return { error: 'Job photos & voice module is off' };
    }

    const { supabase } = await loadAssignedJob(jobId);
    const { data: att, error: attErr } = await supabase
      .from('job_attachments')
      .select('id, kind, url, caption')
      .eq('id', attachmentId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (attErr || !att) {
      return { error: attErr?.message || 'Attachment not found' };
    }
    if (att.kind !== 'voice' || !att.url) {
      return { error: 'Select a voice note' };
    }

    const audioRes = await fetch(att.url);
    if (!audioRes.ok) {
      return { error: 'Could not download voice file' };
    }
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const contentType =
      audioRes.headers.get('content-type') || 'audio/webm';
    const filename =
      att.url.split('?')[0].split('/').pop() || 'voice.webm';

    const { transcribeAudioBuffer } = await import('@/lib/ai/transcribe');
    const transcript = await transcribeAudioBuffer(
      buffer,
      filename,
      contentType,
      'voice'
    );

    const { data: job } = await supabase
      .from('jobs')
      .select('job_type, diagnosis, customer_summary, internal_notes')
      .eq('id', jobId)
      .maybeSingle();

    const { voiceNotesFromTranscript } = await import('@/lib/grok');
    const fill = await voiceNotesFromTranscript({
      transcript,
      jobType: job?.job_type,
      existingDiagnosis: job?.diagnosis,
    });

    const merge = (prev: string | null | undefined, next: string | null | undefined) => {
      const a = (prev || '').trim();
      const b = (next || '').trim();
      if (!b) return a || null;
      if (!a) return b;
      if (a.includes(b)) return a;
      return `${a}\n\n${b}`;
    };

    const { error } = await supabase
      .from('jobs')
      .update({
        diagnosis: fill.diagnosis || job?.diagnosis || null,
        customer_summary:
          fill.customer_summary || job?.customer_summary || null,
        internal_notes: merge(job?.internal_notes, fill.internal_notes),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) return { error: error.message };

    await supabase
      .from('job_attachments')
      .update({
        caption: `Transcript: ${transcript.slice(0, 280)}${transcript.length > 280 ? '…' : ''}`,
      })
      .eq('id', attachmentId);

    revalidateTechJob(jobId);
    return { success: 'Voice transcribed into diagnosis & summary' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Transcription failed',
    };
  }
}

export async function deleteJobAttachment(
  jobId: string,
  attachmentId: string
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('media');
    if (!perm.ok) return { error: perm.error };
    await loadAssignedJob(jobId);
    const admin = createServiceClient();
    const { error } = await admin
      .from('job_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('job_id', jobId);
    if (error) return { error: error.message };
    revalidateTechJob(jobId);
    return { success: 'Removed' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed' };
  }
}

/** Quick truck-stock deduct from the job (tech or office). */
export async function deductTruckStock(
  jobId: string,
  itemId: string,
  qty: number
): Promise<TechActionState> {
  try {
    const perm = await assertTechCapability('inventory_deduct');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await loadAssignedJob(jobId);
    if (qty <= 0) return { error: 'Qty must be positive' };

    const { data: item } = await supabase
      .from('inventory_items')
      .select('id, qty_on_hand, name, cost, sell_price')
      .eq('id', itemId)
      .maybeSingle();

    if (!item) return { error: 'Item not found' };
    const next = Math.max(0, Number(item.qty_on_hand) - qty);

    const { error } = await supabase
      .from('inventory_items')
      .update({ qty_on_hand: next, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) return { error: error.message };

    // Best-effort note on job so office sees usage
    const noteLine = `Used ${qty}× ${item.name} (truck stock → ${next})`;
    const { data: job } = await supabase
      .from('jobs')
      .select('internal_notes')
      .eq('id', jobId)
      .maybeSingle();
    const prev = job?.internal_notes?.trim() || '';
    await supabase
      .from('jobs')
      .update({
        internal_notes: prev ? `${prev}\n${noteLine}` : noteLine,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Add/update costed line item + refresh job P&L
    try {
      const { applyInventoryUseToJob } = await import(
        '@/lib/jobs/apply-inventory-to-job'
      );
      const applied = await applyInventoryUseToJob(supabase, jobId, item, qty);
      if (applied.error) {
        console.warn('inventory→line item', applied.error);
      }
    } catch (err) {
      console.warn('inventory→line item failed', err);
    }

    revalidateTechJob(jobId);
    revalidatePath('/dashboard/inventory');
    return {
      success: `Deducted ${qty}× ${item.name} (added to job with cost)`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Deduct failed' };
  }
}
