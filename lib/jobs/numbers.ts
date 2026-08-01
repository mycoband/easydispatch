function parseSequentialNumber(value: string | null | undefined): number | null {
  const trimmed = (value || '').trim();
  const m = trimmed.match(/^#?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type JobsQueryClient = {
  from: (table: 'jobs') => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        range: (
          from: number,
          to: number
        ) => Promise<{ data: { job_number: string | null }[] | null; error: unknown }>;
      };
      range: (
        from: number,
        to: number
      ) => Promise<{ data: { job_number: string | null }[] | null; error: unknown }>;
    };
  };
};

/**
 * Next default job number for a company: #1, #2, #3…
 * Custom names (e.g. "River Market Bistro") do not affect the sequence.
 */
export async function allocateNextJobNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId?: string | null
): Promise<string> {
  const client = supabase as JobsQueryClient;
  let max = 0;
  const page = 1000;

  for (let from = 0; ; from += page) {
    const base = client.from('jobs').select('job_number');
    const { data } = companyId
      ? await base.eq('company_id', companyId).range(from, from + page - 1)
      : await base.range(from, from + page - 1);

    if (!data?.length) break;
    for (const row of data) {
      const n = parseSequentialNumber(row.job_number);
      if (n != null && n > max) max = n;
    }
    if (data.length < page) break;
  }

  return `#${max + 1}`;
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
