'use server';

import { revalidatePath } from 'next/cache';
import {
  deleteJobAttachment,
  uploadJobAttachment,
} from '@/app/tech/actions';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import {
  buildSavedWalkthrough,
  mergeWalkthroughFromAi,
  normalizeWalkthrough,
  WALKTHROUGH_MEDIA_TAG,
  type JobWalkthrough,
  type WalkthroughReportInput,
} from '@/lib/jobs/walkthrough';

export type WalkthroughActionState = { error?: string; success?: string };

async function loadAssignedJob(jobId: string) {
  const { supabase, user, profile } = await requireProfile();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, assigned_to, walkthrough')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    if (/walkthrough|column|schema cache/i.test(error.message)) {
      const retry = await supabase
        .from('jobs')
        .select('id, assigned_to')
        .eq('id', jobId)
        .maybeSingle();
      if (retry.error || !retry.data) {
        throw new Error(
          retry.error?.message ||
            'Job not found. Run supabase/ai-walkthrough.sql in Supabase.'
        );
      }
      const office = isOfficeRole(profile.role);
      if (!office && retry.data.assigned_to !== user.id) {
        throw new Error('You are not assigned to this job');
      }
      return {
        supabase,
        user,
        profile,
        job: { ...retry.data, walkthrough: null as unknown },
        columnMissing: true as const,
      };
    }
    throw new Error(error.message || 'Job not found');
  }

  if (!job) throw new Error('Job not found');

  const office = isOfficeRole(profile.role);
  if (!office && job.assigned_to !== user.id) {
    throw new Error('You are not assigned to this job');
  }

  return { supabase, user, profile, job, columnMissing: false as const };
}

function revalidateJob(jobId: string) {
  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath('/tech');
}

/** Phase 1: persist free-text notes + mark walkthrough in progress. */
export async function saveWalkthroughDraft(
  jobId: string,
  input: { notes: string }
): Promise<WalkthroughActionState> {
  try {
    const perm = await assertTechCapability('edit_notes');
    if (!perm.ok) return { error: perm.error };

    const { supabase, job, columnMissing } = await loadAssignedJob(jobId);
    if (columnMissing) {
      return {
        error:
          'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
      };
    }

    const current = normalizeWalkthrough(job.walkthrough);
    const notes = input.notes?.trim() || null;
    const next: JobWalkthrough = {
      ...current,
      notes,
      status:
        current.status === 'none' || current.status === 'in_progress'
          ? notes
            ? 'in_progress'
            : 'none'
          : current.status,
    };

    const { error } = await supabase
      .from('jobs')
      .update({
        walkthrough: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      if (/walkthrough|column|schema cache/i.test(error.message)) {
        return {
          error:
            'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
        };
      }
      return { error: error.message };
    }

    revalidateJob(jobId);
    return { success: 'Walkthrough draft saved' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Save failed',
    };
  }
}

async function bumpWalkthroughInProgress(jobId: string) {
  try {
    const { supabase, job, columnMissing } = await loadAssignedJob(jobId);
    if (columnMissing) return;
    const current = normalizeWalkthrough(job.walkthrough);
    if (current.status !== 'none') return;
    const next: JobWalkthrough = { ...current, status: 'in_progress' };
    await supabase
      .from('jobs')
      .update({
        walkthrough: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch {
    // Media already saved; status bump is best-effort
  }
}

/** Phase 2: photo/voice into job_attachments with tag walkthrough. */
export async function uploadWalkthroughMedia(
  jobId: string,
  formData: FormData
): Promise<WalkthroughActionState> {
  formData.set('tag', WALKTHROUGH_MEDIA_TAG);
  const result = await uploadJobAttachment(jobId, formData);
  if (result.error) return result;
  await bumpWalkthroughInProgress(jobId);
  revalidateJob(jobId);
  const kind = String(formData.get('kind') || '');
  return {
    success:
      kind === 'voice'
        ? 'Walkthrough voice saved'
        : kind === 'video'
          ? 'Walkthrough video saved'
          : 'Walkthrough photo saved',
  };
}

export async function deleteWalkthroughMedia(
  jobId: string,
  attachmentId: string
): Promise<WalkthroughActionState> {
  return deleteJobAttachment(jobId, attachmentId);
}

/**
 * Whisper a walkthrough voice/video → caption + append into walkthrough.notes.
 * Does not touch diagnosis / customer_summary (those stay on Job photos).
 */
export async function transcribeWalkthroughVoice(
  jobId: string,
  attachmentId: string
): Promise<WalkthroughActionState> {
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
    if (!company.modules.ai_walkthrough) {
      return { error: 'AI Job Walkthrough module is off' };
    }

    const { supabase, job, columnMissing } = await loadAssignedJob(jobId);
    if (columnMissing) {
      return {
        error:
          'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
      };
    }

    const { data: att, error: attErr } = await supabase
      .from('job_attachments')
      .select('id, kind, tag, url, caption')
      .eq('id', attachmentId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (attErr || !att) {
      return { error: attErr?.message || 'Attachment not found' };
    }
    if ((att.kind !== 'voice' && att.kind !== 'video') || !att.url) {
      return { error: 'Select a walkthrough voice note or video' };
    }
    if (att.tag !== WALKTHROUGH_MEDIA_TAG) {
      return { error: 'Not a walkthrough attachment' };
    }

    const audioRes = await fetch(att.url);
    if (!audioRes.ok) {
      return { error: 'Could not download media file' };
    }
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const contentType =
      audioRes.headers.get('content-type') ||
      (att.kind === 'video' ? 'video/webm' : 'audio/webm');
    const filename =
      att.url.split('/').pop() ||
      (att.kind === 'video' ? 'walkthrough.webm' : 'voice.webm');

    const { transcribeAudioBuffer } = await import('@/lib/ai/transcribe');
    const transcript = await transcribeAudioBuffer(
      buffer,
      filename,
      contentType
    );

    const caption = `Transcript: ${transcript.slice(0, 480)}${
      transcript.length > 480 ? '…' : ''
    }`;
    await supabase
      .from('job_attachments')
      .update({ caption })
      .eq('id', attachmentId);

    const current = normalizeWalkthrough(job.walkthrough);
    const prev = (current.notes || '').trim();
    const mergedNotes = prev
      ? prev.includes(transcript)
        ? prev
        : `${prev}\n\n${transcript}`
      : transcript;
    const next: JobWalkthrough = {
      ...current,
      notes: mergedNotes,
      status:
        current.status === 'none' || current.status === 'in_progress'
          ? 'in_progress'
          : current.status,
    };

    const { error } = await supabase
      .from('jobs')
      .update({
        walkthrough: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) return { error: error.message };

    revalidateJob(jobId);
    return {
      success:
        att.kind === 'video'
          ? 'Video audio transcribed into walkthrough notes'
          : 'Voice transcribed into walkthrough notes',
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Transcription failed',
    };
  }
}

function transcriptFromCaption(caption: string | null | undefined): string {
  if (!caption?.trim()) return '';
  const t = caption.trim();
  const stripped = t.replace(/^Transcript:\s*/i, '').trim();
  return stripped || t;
}

/**
 * Phase 3: Grok → fill walkthrough report fields; status generated.
 * Persists latest notes first when provided.
 */
export async function generateWalkthroughReportAction(
  jobId: string,
  input?: { notes?: string }
): Promise<WalkthroughActionState> {
  try {
    const notesPerm = await assertTechCapability('edit_notes');
    if (!notesPerm.ok) return { error: notesPerm.error };

    const { loadCompanySettings } = await import('@/lib/company');
    const company = await loadCompanySettings();
    if (!company.modules.ai) {
      return { error: 'Turn on AI tools in Settings → Feature modules' };
    }
    if (!company.modules.ai_walkthrough) {
      return { error: 'AI Job Walkthrough module is off' };
    }

    const { supabase, job, columnMissing } = await loadAssignedJob(jobId);
    if (columnMissing) {
      return {
        error:
          'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
      };
    }

    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .select(
        'id, job_type, customer_name, customer_id, equipment_id, walkthrough, diagnosis'
      )
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !jobRow) {
      return { error: jobErr?.message || 'Job not found' };
    }

    let current = normalizeWalkthrough(jobRow.walkthrough ?? job.walkthrough);
    const notesIn =
      input?.notes !== undefined ? input.notes.trim() : current.notes || '';
    if (input?.notes !== undefined) {
      current = {
        ...current,
        notes: notesIn || null,
        status:
          current.status === 'none' || current.status === 'in_progress'
            ? notesIn
              ? 'in_progress'
              : current.status
            : current.status,
      };
    }

    const { data: mediaRows } = await supabase
      .from('job_attachments')
      .select('id, kind, tag, url, caption')
      .eq('job_id', jobId)
      .eq('tag', WALKTHROUGH_MEDIA_TAG)
      .order('created_at', { ascending: true })
      .limit(60);

    const media = mediaRows ?? [];
    const photoUrls = media
      .filter((m) => m.kind === 'photo' && m.url)
      .map((m) => m.url as string);
    const videoRows = media.filter((m) => m.kind === 'video' && m.url);
    const videoUrls = videoRows.map((m) => m.url as string);

    // Prove Grok can fetch public video URLs (Supabase job-media must be public)
    for (const url of videoUrls) {
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) {
          const get = await fetch(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-1023' },
          });
          if (!get.ok) {
            return {
              error: `Walkthrough video is not publicly reachable (${get.status}). Check job-media bucket is public.`,
            };
          }
        }
      } catch {
        return {
          error:
            'Could not reach walkthrough video URL. Check job-media storage is public.',
        };
      }
    }

    // Whisper audio from voice/video so Grok has spoken words + the video itself
    const voiceTranscripts: string[] = [];
    let autoTxCount = 0;
    for (const m of media.filter(
      (row) => row.kind === 'voice' || row.kind === 'video'
    )) {
      let text = transcriptFromCaption(m.caption);
      if (!text && m.url && process.env.OPENAI_API_KEY?.trim()) {
        try {
          const audioRes = await fetch(m.url);
          if (audioRes.ok) {
            const buffer = Buffer.from(await audioRes.arrayBuffer());
            const contentType =
              audioRes.headers.get('content-type') ||
              (m.kind === 'video' ? 'video/mp4' : 'audio/webm');
            const filename =
              m.url.split('/').pop() ||
              (m.kind === 'video' ? 'walkthrough.mp4' : 'voice.webm');
            const { transcribeAudioBuffer } = await import(
              '@/lib/ai/transcribe'
            );
            text = await transcribeAudioBuffer(buffer, filename, contentType);
            if (text) {
              const caption = `Transcript: ${text.slice(0, 480)}${
                text.length > 480 ? '…' : ''
              }`;
              await supabase
                .from('job_attachments')
                .update({ caption })
                .eq('id', m.id);
              autoTxCount += 1;
            }
          }
        } catch (txErr) {
          console.warn('Walkthrough Whisper failed', txErr);
        }
      }
      if (text) voiceTranscripts.push(text);
    }

    if (videoUrls.length > 0 && voiceTranscripts.length === 0) {
      if (!process.env.OPENAI_API_KEY?.trim()) {
        return {
          error:
            'OPENAI_API_KEY is required so Grok can hear the video (Whisper). Add it in Vercel env, redeploy, then Generate again.',
        };
      }
      return {
        error:
          'Could not hear speech in the walkthrough video. Re-record with clear narration, then Generate again.',
      };
    }

    if (videoUrls.length > 0 && photoUrls.length === 0) {
      return {
        error:
          'No frames from the video yet. Re-upload or re-record the walkthrough video (frames are extracted automatically for Grok to see).',
      };
    }

    // Fold new transcripts into field notes when notes were empty-ish
    if (autoTxCount > 0) {
      const joined = voiceTranscripts.join('\n\n');
      const prev = notesIn.trim();
      const mergedNotes = prev
        ? prev.includes(joined.slice(0, 40))
          ? prev
          : `${prev}\n\n${joined}`
        : joined;
      current = {
        ...current,
        notes: mergedNotes || null,
        status:
          current.status === 'none' || current.status === 'in_progress'
            ? 'in_progress'
            : current.status,
      };
    }

    const notesForAi =
      (autoTxCount > 0 ? current.notes : notesIn)?.trim() ||
      notesIn ||
      '';

    if (
      !notesForAi &&
      voiceTranscripts.length === 0 &&
      photoUrls.length === 0 &&
      videoUrls.length === 0
    ) {
      return {
        error:
          'Add a video walkthrough, field notes, voice, or photo first.',
      };
    }

    let equipmentSummary: string | null = null;
    if (jobRow.equipment_id) {
      const { data: eq } = await supabase
        .from('equipment')
        .select('name, equipment_type, manufacturer, model')
        .eq('id', jobRow.equipment_id)
        .maybeSingle();
      if (eq) {
        equipmentSummary = [
          eq.name,
          eq.equipment_type,
          eq.manufacturer,
          eq.model,
        ]
          .filter(Boolean)
          .join(' · ');
      }
    }

    const { generateWalkthroughReport } = await import('@/lib/grok');
    const ai = await generateWalkthroughReport({
      notes:
        notesForAi ||
        (jobRow.diagnosis ? `Job diagnosis: ${jobRow.diagnosis}` : ''),
      voiceTranscripts,
      photoUrls,
      videoUrls,
      jobType: jobRow.job_type,
      equipmentSummary,
      customerName: jobRow.customer_name,
    });

    const next = mergeWalkthroughFromAi(
      {
        ...current,
        notes: current.notes || notesForAi || null,
      },
      {
        findings: ai.findings,
        work_performed: ai.work_performed,
        recommendations: ai.recommendations,
        customer_summary: ai.customer_summary,
        parts_used: ai.parts_used,
        labor_hours_estimated: ai.labor_hours_estimated ?? null,
        labor_rate: ai.labor_rate ?? null,
      }
    );

    const { error } = await supabase
      .from('jobs')
      .update({
        walkthrough: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) return { error: error.message };

    revalidateJob(jobId);
    const bits: string[] = [];
    if (videoUrls.length > 0) {
      bits.push(`saw ${photoUrls.length} frame${photoUrls.length === 1 ? '' : 's'}`);
      bits.push(
        `heard ${voiceTranscripts.length} transcript${
          voiceTranscripts.length === 1 ? '' : 's'
        }`
      );
    }
    if (autoTxCount > 0 && videoUrls.length === 0) {
      bits.push(
        `transcribed ${autoTxCount} clip${autoTxCount === 1 ? '' : 's'}`
      );
    }
    return {
      success:
        bits.length > 0
          ? `Report generated (${bits.join(' · ')}) — review below`
          : 'Report generated — review below',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Generate failed',
    };
  }
}

/**
 * Phase 4: persist edited report to jobs.walkthrough; status saved.
 * Preserves original raw_ai from generation.
 */
export async function saveWalkthroughToJob(
  jobId: string,
  input: WalkthroughReportInput
): Promise<WalkthroughActionState> {
  try {
    const perm = await assertTechCapability('edit_notes');
    if (!perm.ok) return { error: perm.error };

    const { supabase, job, columnMissing } = await loadAssignedJob(jobId);
    if (columnMissing) {
      return {
        error:
          'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
      };
    }

    const current = normalizeWalkthrough(job.walkthrough);
    const hasContent =
      Boolean(input.findings?.trim()) ||
      Boolean(input.work_performed?.trim()) ||
      Boolean(input.recommendations?.trim()) ||
      Boolean(input.customer_summary?.trim()) ||
      (input.parts || []).some((p) => p.name?.trim()) ||
      input.labor_hours != null ||
      input.labor_rate != null;

    if (!hasContent) {
      return { error: 'Nothing to save — generate or fill the report first' };
    }

    const next = buildSavedWalkthrough(current, input);

    const { error } = await supabase
      .from('jobs')
      .update({
        walkthrough: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      if (/walkthrough|column|schema cache/i.test(error.message)) {
        return {
          error:
            'Walkthrough column missing. Run supabase/ai-walkthrough.sql in the Supabase SQL editor.',
        };
      }
      return { error: error.message };
    }

    const linePerm = await assertTechCapability('edit_line_items');
    const { applyWalkthroughToJobFields } = await import(
      '@/lib/jobs/walkthrough-apply'
    );
    let extras = '';
    try {
      const applied = await applyWalkthroughToJobFields(
        supabase,
        jobId,
        next,
        { syncLineItems: linePerm.ok }
      );
      if (applied.notesUpdated) {
        extras += ' · copied to diagnosis / customer summary';
      }
      if (applied.lineItemsSynced && linePerm.ok) {
        extras += ' · parts/labor synced to line items';
      }
    } catch {
      extras += ' · report saved (job field sync skipped)';
    }

    revalidateJob(jobId);
    return { success: `Walkthrough saved to job${extras}` };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Save failed',
    };
  }
}
