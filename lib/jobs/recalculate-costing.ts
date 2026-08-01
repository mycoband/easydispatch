import type { createClient } from '@/lib/supabase/server';
import { loadCompanySettings } from '@/lib/company';
import { computeJobCosting, normalizeCosting } from '@/lib/jobs/costing';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Recompute and persist job P&L snapshot. Safe no-op if columns missing. */
export async function recalculateJobCosting(
  supabase: Supabase,
  jobId: string
): Promise<void> {
  const company = await loadCompanySettings();
  if (!company.modules.job_costing) return;

  const { data: job } = await supabase
    .from('jobs')
    .select('id, subtotal, actual_hours, assigned_to')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return;

  const [{ data: lines }, { data: orders }, techRes] = await Promise.all([
    supabase
      .from('line_items')
      .select('qty, unit_price, unit_cost, item_type')
      .eq('job_id', jobId),
    supabase
      .from('job_part_orders')
      .select('qty, unit_cost, status')
      .eq('job_id', jobId),
    job.assigned_to
      ? supabase
          .from('profiles')
          .select('hourly_cost, burden_pct')
          .eq('id', job.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const part_order_costs = (orders ?? [])
    .filter((o) => ['received', 'installed', 'ordered'].includes(o.status || ''))
    .reduce(
      (s, o) => s + (Number(o.qty) || 0) * (Number(o.unit_cost) || 0),
      0
    );

  const result = computeJobCosting({
    lines: (lines ?? []).map((l) => ({
      qty: Number(l.qty) || 0,
      unit_price: Number(l.unit_price) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      item_type: l.item_type,
    })),
    revenue: Number(job.subtotal) || undefined,
    actual_hours: job.actual_hours,
    tech_hourly_cost: techRes.data?.hourly_cost ?? null,
    tech_burden_pct: techRes.data?.burden_pct ?? null,
    part_order_costs,
    costing: normalizeCosting(company.costing),
  });

  const { error } = await supabase
    .from('jobs')
    .update({
      cost_materials: result.material_cost,
      cost_labor: result.labor_cost,
      cost_overhead: result.overhead_cost,
      cost_total: result.total_cost,
      gross_profit: result.gross_profit,
      margin_pct: result.margin_pct,
      costing_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error && /column|schema cache/i.test(error.message)) {
    console.warn('Job costing columns missing — run supabase/job-costing.sql');
  }
}
