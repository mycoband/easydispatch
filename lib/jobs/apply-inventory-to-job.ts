import type { createClient } from '@/lib/supabase/server';
import { computeJobTotals } from '@/lib/jobs/totals';
import { recalculateJobCosting } from '@/lib/jobs/recalculate-costing';
import { loadCompanySettings } from '@/lib/company';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * After truck stock is deducted: add/update a costed parts line on the job
 * and refresh sell totals + P&L when job costing is enabled.
 */
export async function applyInventoryUseToJob(
  supabase: Supabase,
  jobId: string,
  item: {
    id: string;
    name: string;
    cost?: number | null;
    sell_price?: number | null;
  },
  qty: number
): Promise<{ error?: string }> {
  const unitCost = Number(item.cost) || 0;
  const unitPrice =
    Number(item.sell_price) > 0 ? Number(item.sell_price) : unitCost;

  const { data: existing } = await supabase
    .from('line_items')
    .select('id, qty, unit_price, unit_cost')
    .eq('job_id', jobId)
    .eq('inventory_item_id', item.id)
    .maybeSingle();

  if (existing?.id) {
    const nextQty = (Number(existing.qty) || 0) + qty;
    const { error } = await supabase
      .from('line_items')
      .update({
        qty: nextQty,
        unit_cost: unitCost || Number(existing.unit_cost) || 0,
        unit_price:
          Number(existing.unit_price) > 0
            ? existing.unit_price
            : unitPrice,
        item_type: 'parts',
      })
      .eq('id', existing.id);
    if (error && /unit_cost|inventory_item_id|item_type|column/i.test(error.message)) {
      // Fallback: bump qty only on legacy schema
      const { error: e2 } = await supabase
        .from('line_items')
        .update({ qty: nextQty })
        .eq('id', existing.id);
      if (e2) return { error: e2.message };
    } else if (error) {
      return { error: error.message };
    }
  } else {
    const { data: maxSort } = await supabase
      .from('line_items')
      .select('sort_order')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = (Number(maxSort?.sort_order) || 0) + 1;
    const row = {
      job_id: jobId,
      description: item.name,
      qty,
      unit_price: unitPrice,
      unit_cost: unitCost,
      item_type: 'parts',
      inventory_item_id: item.id,
      taxable: true,
      sort_order,
    };

    const { error } = await supabase.from('line_items').insert(row);
    if (error && /unit_cost|inventory_item_id|item_type|column/i.test(error.message)) {
      const { error: e2 } = await supabase.from('line_items').insert({
        job_id: jobId,
        description: item.name,
        qty,
        unit_price: unitPrice,
        taxable: true,
        sort_order,
      });
      if (e2) return { error: e2.message };
    } else if (error) {
      return { error: error.message };
    }
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('tax_rate, tax_rate_id')
    .eq('id', jobId)
    .maybeSingle();

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

  return {};
}
