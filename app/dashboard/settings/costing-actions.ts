'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { normalizeCosting, type CostingSettings } from '@/lib/jobs/costing';

export type ActionState = { error?: string; success?: string };

export async function saveCostingSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, profile } = await requireOffice();
  if (!profile.company_id) {
    return { error: 'No company linked to your account.' };
  }

  const costing: CostingSettings = normalizeCosting({
    target_margin_pct: Number(formData.get('target_margin_pct')),
    default_burden_pct: Number(formData.get('default_burden_pct')),
    overhead_per_hour: Number(formData.get('overhead_per_hour')),
    overhead_pct_of_revenue: Number(formData.get('overhead_pct_of_revenue')),
    default_labor_cost_per_hour: Number(
      formData.get('default_labor_cost_per_hour')
    ),
    tech_see_costs: formData.get('tech_see_costs') === 'on',
    weekly_digest_enabled: formData.get('weekly_digest_enabled') === 'on',
    weekly_digest_email: String(formData.get('weekly_digest_email') || ''),
  });

  const { error } = await supabase
    .from('company_settings')
    .update({ costing })
    .eq('company_id', profile.company_id);

  if (error) {
    return {
      error: /costing|column|schema cache/i.test(error.message)
        ? 'Could not save costing settings. Check Settings, then try again, or contact support.'
        : error.message,
    };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/reports');
  revalidatePath('/dashboard/jobs');
  return { success: 'Costing settings saved' };
}

export async function saveTechWage(
  techId: string,
  hourlyCost: number | null,
  burdenPct: number | null
): Promise<ActionState> {
  const { supabase, profile } = await requireOffice();
  if (!techId) return { error: 'Missing tech' };

  const { error } = await supabase
    .from('profiles')
    .update({
      hourly_cost: hourlyCost,
      burden_pct: burdenPct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', techId)
    .eq('company_id', profile.company_id || '');

  if (error) {
    return {
      error: /hourly_cost|burden_pct|column|schema cache/i.test(error.message)
        ? 'Could not save wage. Check Settings, then try again, or contact support.'
        : error.message,
    };
  }

  revalidatePath('/dashboard/settings');
  return { success: 'Wage saved' };
}
