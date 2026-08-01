import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCompanySettings } from '@/lib/company';
import { recalculateJobCosting } from '@/lib/jobs/recalculate-costing';
import { computeJobTotals } from '@/lib/jobs/totals';
import type { JobWalkthrough } from '@/lib/jobs/walkthrough';

const LINE_PREFIX = 'Walkthrough: ';

function mergeText(
  prev: string | null | undefined,
  next: string | null | undefined
): string | null {
  const a = (prev || '').trim();
  const b = (next || '').trim();
  if (!b) return a || null;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n\n${b}`;
}

/**
 * After Save to Job: copy summary/findings onto job notes fields,
 * and sync walkthrough parts/labor onto line items (prefixed so re-save replaces).
 */
export async function applyWalkthroughToJobFields(
  supabase: SupabaseClient,
  jobId: string,
  walkthrough: JobWalkthrough,
  options: { syncLineItems: boolean }
): Promise<{ lineItemsSynced: boolean; notesUpdated: boolean }> {
  const { data: job } = await supabase
    .from('jobs')
    .select('diagnosis, customer_summary, tax_rate')
    .eq('id', jobId)
    .maybeSingle();

  const diagnosis = mergeText(job?.diagnosis, walkthrough.findings);
  const customer_summary = mergeText(
    job?.customer_summary,
    walkthrough.customer_summary
  );

  await supabase
    .from('jobs')
    .update({
      diagnosis,
      customer_summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  let lineItemsSynced = false;
  if (options.syncLineItems) {
    // Remove prior walkthrough lines so Save is idempotent
    const { data: existing } = await supabase
      .from('line_items')
      .select('id, description')
      .eq('job_id', jobId);

    const toDelete = (existing ?? [])
      .filter((l) =>
        String(l.description || '').startsWith(LINE_PREFIX)
      )
      .map((l) => l.id);

    if (toDelete.length) {
      await supabase.from('line_items').delete().in('id', toDelete);
    }

    const { data: remaining } = await supabase
      .from('line_items')
      .select('sort_order')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: false })
      .limit(1);

    let sort =
      remaining?.[0]?.sort_order != null
        ? Number(remaining[0].sort_order) + 1
        : 0;

    const rows: {
      job_id: string;
      description: string;
      qty: number;
      unit_price: number;
      unit_cost: number;
      item_type: string;
      taxable: boolean;
      sort_order: number;
    }[] = [];

    for (const p of walkthrough.parts) {
      if (!p.name.trim()) continue;
      rows.push({
        job_id: jobId,
        description: `${LINE_PREFIX}${p.name.trim()}`,
        qty: Number(p.quantity) || 1,
        unit_price: Number(p.estimated_cost) || 0,
        unit_cost: 0,
        item_type: 'parts',
        taxable: true,
        sort_order: sort++,
      });
    }

    if (
      walkthrough.labor_hours != null &&
      walkthrough.labor_hours > 0 &&
      walkthrough.labor_rate != null
    ) {
      rows.push({
        job_id: jobId,
        description: `${LINE_PREFIX}Labor`,
        qty: Number(walkthrough.labor_hours) || 0,
        unit_price: Number(walkthrough.labor_rate) || 0,
        unit_cost: 0,
        item_type: 'labor',
        taxable: true,
        sort_order: sort++,
      });
    }

    if (rows.length) {
      const { error } = await supabase.from('line_items').insert(rows);
      if (error && /unit_cost|item_type|column/i.test(error.message)) {
        const { error: e2 } = await supabase.from('line_items').insert(
          rows.map(({ unit_cost: _c, item_type: _t, ...rest }) => rest)
        );
        if (!e2) lineItemsSynced = true;
      } else if (!error) {
        lineItemsSynced = true;
      }
    } else {
      lineItemsSynced = true;
    }

    const { data: lines } = await supabase
      .from('line_items')
      .select('qty, unit_price, taxable')
      .eq('job_id', jobId);

    const taxRate = Number(job?.tax_rate) || 0;
    const totals = computeJobTotals(
      (lines ?? []).map((l) => ({
        qty: Number(l.qty) || 0,
        unit_price: Number(l.unit_price) || 0,
        taxable: Boolean(l.taxable),
      })),
      taxRate
    );

    await supabase
      .from('jobs')
      .update({
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total: totals.total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    try {
      const company = await loadCompanySettings();
      if (company.modules.job_costing) {
        await recalculateJobCosting(supabase, jobId);
      }
    } catch {
      /* optional */
    }
  }

  return { lineItemsSynced, notesUpdated: true };
}
