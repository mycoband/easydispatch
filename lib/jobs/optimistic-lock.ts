/** Shown when another user (or tab) saved the job since this form was loaded. */
export const JOB_CONFLICT_MESSAGE =
  'Someone else saved — reload to see their changes.';

export function normalizeJobUpdatedAt(
  raw: string | null | undefined
): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return String(raw).trim();
  return new Date(ms).toISOString();
}

/**
 * Update a job only if `updated_at` still matches what the client loaded.
 * Returns conflict when another save happened in between.
 */
export async function updateJobIfUnchanged(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  jobId: string,
  expectedUpdatedAt: string | null | undefined,
  patch: Record<string, unknown>
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; conflict: true; error: string }
  | { ok: false; conflict: false; error: string }
> {
  const expected = normalizeJobUpdatedAt(expectedUpdatedAt);

  const { data: current, error: readErr } = await supabase
    .from('jobs')
    .select('id, updated_at')
    .eq('id', jobId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, conflict: false, error: readErr.message };
  }
  if (!current) {
    return { ok: false, conflict: false, error: 'Job not found' };
  }

  const currentNorm = normalizeJobUpdatedAt(current.updated_at);
  if (currentNorm !== expected) {
    return { ok: false, conflict: true, error: JOB_CONFLICT_MESSAGE };
  }

  const nextUpdatedAt = new Date().toISOString();
  const body = {
    ...patch,
    updated_at: nextUpdatedAt,
  };

  // Re-check with the exact DB timestamp to close the small race window.
  let q = supabase.from('jobs').update(body).eq('id', jobId);
  const { data: written, error: writeErr } =
    current.updated_at == null
      ? await q.is('updated_at', null).select('id, updated_at').maybeSingle()
      : await q
          .eq('updated_at', current.updated_at)
          .select('id, updated_at')
          .maybeSingle();

  if (writeErr) {
    return { ok: false, conflict: false, error: writeErr.message };
  }
  if (!written?.id) {
    return { ok: false, conflict: true, error: JOB_CONFLICT_MESSAGE };
  }

  return {
    ok: true,
    updatedAt: normalizeJobUpdatedAt(written.updated_at) || nextUpdatedAt,
  };
}
