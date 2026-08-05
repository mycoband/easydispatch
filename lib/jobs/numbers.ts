function parseSequentialNumber(value: string | null | undefined): number | null {
  const trimmed = (value || '').trim();
  const m = trimmed.match(/^#?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Next default job number for a company: #1, #2, #3…
 * Custom names (e.g. "River Market Bistro") do not affect the sequence.
 *
 * Also guarantees the value is free under the legacy global unique
 * `jobs_job_number_key` constraint (multi-tenant shops were colliding on #1).
 */
export async function allocateNextJobNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId?: string | null
): Promise<string> {
  let max = 0;
  const page = 1000;

  for (let from = 0; ; from += page) {
    let q = supabase.from('jobs').select('job_number');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q.range(from, from + page - 1);

    if (!data?.length) break;
    for (const row of data as { job_number: string | null }[]) {
      const n = parseSequentialNumber(row.job_number);
      if (n != null && n > max) max = n;
    }
    if (data.length < page) break;
  }

  let candidate = max + 1;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const jobNumber = `#${candidate}`;
    const { data: taken } = await supabase
      .from('jobs')
      .select('id')
      .eq('job_number', jobNumber)
      .limit(1)
      .maybeSingle();
    if (!taken) return jobNumber;
    candidate += 1;
  }

  return generateJobNumber();
}

/** Sync fallback — prefer allocateNextJobNumber for real creates. */
export function generateJobNumber() {
  return `#${Date.now().toString().slice(-6)}`;
}

/** Generate a readable unique-ish estimate number. */
export function generateEstimateNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EST-${y}${m}${d}-${rand}`;
}
