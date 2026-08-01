import type { createClient } from '@/lib/supabase/server';
import { HVAC_LINE_PRESETS } from '@/lib/hvac/presets';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PricebookPreset = {
  label: string;
  description: string;
  qty: number;
  unit_price: number;
  unit_cost?: number;
  item_type?: 'labor' | 'parts' | 'other';
  taxable: boolean;
};

/** Load active pricebook rows, falling back to static HVAC presets. */
export async function loadPricebookPresets(
  supabase: Supabase
): Promise<PricebookPreset[]> {
  const { data, error } = await supabase
    .from('pricebook_items')
    .select('name, description, unit_price, unit_cost, item_type, category, taxable, active')
    .eq('active', true)
    .order('sort_order')
    .order('name');

  if (error || !data?.length) {
    return HVAC_LINE_PRESETS.map((p) => ({
      label: p.label,
      description: p.description,
      qty: p.qty,
      unit_price: p.unit_price,
      unit_cost: 0,
      item_type: /labor/i.test(p.label) ? 'labor' : 'parts',
      taxable: p.taxable,
    }));
  }

  return data.map((row) => {
    const type =
      row.item_type === 'labor' || row.item_type === 'parts'
        ? row.item_type
        : /labor/i.test(row.category || '')
          ? 'labor'
          : 'parts';
    return {
      label: row.name,
      description: row.description || row.name,
      qty: 1,
      unit_price: Number(row.unit_price) || 0,
      unit_cost: Number(row.unit_cost) || 0,
      item_type: type as 'labor' | 'parts' | 'other',
      taxable: Boolean(row.taxable),
    };
  });
}
