import type { SupabaseClient } from '@supabase/supabase-js';

export type GbbActionResult = { error?: string; success?: string };

export const GBB_OPTION_LABELS = ['Good', 'Better', 'Best'] as const;
export type GbbOptionLabel = (typeof GBB_OPTION_LABELS)[number];

/**
 * Approve one estimate in a Good/Better/Best package and reject the
 * sibling options that share the same package_id. Works with either an
 * authenticated (office) client or the service-role client (portal).
 */
export async function approveGbbOptionWith(
  supabase: SupabaseClient,
  estimateId: string
): Promise<GbbActionResult> {
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('id, package_id')
    .eq('id', estimateId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!estimate) return { error: 'Estimate not found' };

  const now = new Date().toISOString();
  const { error: approveError } = await supabase
    .from('estimates')
    .update({ status: 'Approved', updated_at: now })
    .eq('id', estimateId);

  if (approveError) return { error: approveError.message };

  if (estimate.package_id) {
    await supabase
      .from('estimates')
      .update({ status: 'Rejected', updated_at: now })
      .eq('package_id', estimate.package_id)
      .neq('id', estimateId);
  }

  return { success: 'Option approved' };
}
