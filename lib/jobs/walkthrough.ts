/** job_attachments.tag for walkthrough voice/photos (no separate media table). */
export const WALKTHROUGH_MEDIA_TAG = 'walkthrough';

export type WalkthroughStatus =
  | 'none'
  | 'in_progress'
  | 'generated'
  | 'saved';

export type WalkthroughAttachment = {
  id: string;
  kind: string;
  tag: string | null;
  url: string | null;
  caption: string | null;
  created_at: string;
};

export function isWalkthroughAttachment(a: {
  tag?: string | null;
}): boolean {
  return a.tag === WALKTHROUGH_MEDIA_TAG;
}

export function filterWalkthroughAttachments<
  T extends { tag?: string | null },
>(rows: T[]): T[] {
  return rows.filter(isWalkthroughAttachment);
}

export function excludeWalkthroughAttachments<
  T extends { tag?: string | null },
>(rows: T[]): T[] {
  return rows.filter((a) => !isWalkthroughAttachment(a));
}

export type WalkthroughPart = {
  name: string;
  quantity: number;
  estimated_cost: number;
};

export type JobWalkthrough = {
  status: WalkthroughStatus;
  notes: string | null;
  findings: string | null;
  work_performed: string | null;
  recommendations: string | null;
  customer_summary: string | null;
  parts: WalkthroughPart[];
  labor_hours: number | null;
  labor_rate: number | null;
  parts_total: number | null;
  total_estimated: number | null;
  raw_ai: unknown | null;
  generated_at: string | null;
  saved_at: string | null;
};

export const EMPTY_WALKTHROUGH: JobWalkthrough = {
  status: 'none',
  notes: null,
  findings: null,
  work_performed: null,
  recommendations: null,
  customer_summary: null,
  parts: [],
  labor_hours: null,
  labor_rate: null,
  parts_total: null,
  total_estimated: null,
  raw_ai: null,
  generated_at: null,
  saved_at: null,
};

export const WALKTHROUGH_STATUS_LABELS: Record<WalkthroughStatus, string> = {
  none: 'Not started',
  in_progress: 'In progress',
  generated: 'Generated — review',
  saved: 'Saved to job',
};

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function parseParts(raw: unknown): WalkthroughPart[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkthroughPart[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    out.push({
      name,
      quantity: numOrNull(r.quantity) ?? 1,
      estimated_cost: numOrNull(r.estimated_cost) ?? 0,
    });
  }
  return out;
}

export function normalizeWalkthrough(raw: unknown): JobWalkthrough {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_WALKTHROUGH };
  }
  const src = raw as Record<string, unknown>;
  const statusRaw = src.status;
  const status: WalkthroughStatus =
    statusRaw === 'in_progress' ||
    statusRaw === 'generated' ||
    statusRaw === 'saved'
      ? statusRaw
      : 'none';

  return {
    status,
    notes: typeof src.notes === 'string' ? src.notes : null,
    findings: typeof src.findings === 'string' ? src.findings : null,
    work_performed:
      typeof src.work_performed === 'string' ? src.work_performed : null,
    recommendations:
      typeof src.recommendations === 'string' ? src.recommendations : null,
    customer_summary:
      typeof src.customer_summary === 'string' ? src.customer_summary : null,
    parts: parseParts(src.parts),
    labor_hours: numOrNull(src.labor_hours),
    labor_rate: numOrNull(src.labor_rate),
    parts_total: numOrNull(src.parts_total),
    total_estimated: numOrNull(src.total_estimated),
    raw_ai: src.raw_ai ?? null,
    generated_at:
      typeof src.generated_at === 'string' ? src.generated_at : null,
    saved_at: typeof src.saved_at === 'string' ? src.saved_at : null,
  };
}

export function computeWalkthroughTotals(doc: {
  parts: WalkthroughPart[];
  labor_hours: number | null;
  labor_rate: number | null;
}): {
  parts_total: number;
  labor_total: number;
  total_estimated: number;
} {
  const parts_total = doc.parts.reduce(
    (s, p) => s + (Number(p.quantity) || 0) * (Number(p.estimated_cost) || 0),
    0
  );
  const labor_total =
    (Number(doc.labor_hours) || 0) * (Number(doc.labor_rate) || 0);
  return {
    parts_total: Math.round(parts_total * 100) / 100,
    labor_total: Math.round(labor_total * 100) / 100,
    total_estimated: Math.round((parts_total + labor_total) * 100) / 100,
  };
}

export type WalkthroughReportInput = {
  notes?: string | null;
  findings: string | null;
  work_performed: string | null;
  recommendations: string | null;
  customer_summary: string | null;
  parts: WalkthroughPart[];
  labor_hours: number | null;
  labor_rate: number | null;
};

/** Apply edited report fields; keep raw_ai; set status saved. */
export function buildSavedWalkthrough(
  current: JobWalkthrough,
  input: WalkthroughReportInput,
  savedAt = new Date().toISOString()
): JobWalkthrough {
  const parts = (input.parts || [])
    .map((p) => ({
      name: String(p.name || '').trim(),
      quantity: Number(p.quantity) || 0,
      estimated_cost: Number(p.estimated_cost) || 0,
    }))
    .filter((p) => p.name);
  const next: JobWalkthrough = {
    ...current,
    notes:
      input.notes !== undefined
        ? input.notes?.trim() || null
        : current.notes,
    findings: input.findings?.trim() || null,
    work_performed: input.work_performed?.trim() || null,
    recommendations: input.recommendations?.trim() || null,
    customer_summary: input.customer_summary?.trim() || null,
    parts,
    labor_hours: input.labor_hours,
    labor_rate: input.labor_rate,
    raw_ai: current.raw_ai,
    status: 'saved',
    saved_at: savedAt,
  };
  const totals = computeWalkthroughTotals(next);
  return {
    ...next,
    parts_total: totals.parts_total,
    total_estimated: totals.total_estimated,
  };
}

/** Merge a Grok walkthrough report into the job walkthrough jsonb. */
export function mergeWalkthroughFromAi(
  current: JobWalkthrough,
  ai: {
    findings: string;
    work_performed: string;
    recommendations: string;
    customer_summary: string;
    parts_used: WalkthroughPart[];
    labor_hours_estimated: number | null;
    labor_rate: number | null;
  },
  generatedAt = new Date().toISOString()
): JobWalkthrough {
  const parts = ai.parts_used.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    estimated_cost: p.estimated_cost,
  }));
  const next: JobWalkthrough = {
    ...current,
    status: 'generated',
    findings: ai.findings.trim() || null,
    work_performed: ai.work_performed.trim() || null,
    recommendations: ai.recommendations.trim() || null,
    customer_summary: ai.customer_summary.trim() || null,
    parts,
    labor_hours: ai.labor_hours_estimated,
    labor_rate: ai.labor_rate,
    raw_ai: ai,
    generated_at: generatedAt,
  };
  const totals = computeWalkthroughTotals(next);
  return {
    ...next,
    parts_total: totals.parts_total,
    total_estimated: totals.total_estimated,
  };
}
