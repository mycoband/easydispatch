'use server';

import { revalidatePath } from 'next/cache';
import { approveGbbOptionWith } from '@/lib/estimates/gbb';
import { createServiceClient } from '@/lib/supabase/admin';

export async function approveEstimateViaPortal(token: string) {
  const admin = createServiceClient();
  const { data: link } = await admin
    .from('portal_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!link?.estimate_id) {
    return;
  }

  await approveGbbOptionWith(admin, link.estimate_id);

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/dashboard/estimates/${link.estimate_id}`);
}

/**
 * Approve one option of a Good/Better/Best package from the portal.
 * The token only needs to reference one estimate in the package —
 * the customer can approve any sibling option that shares its package_id.
 */
export async function approveGbbOptionViaPortal(
  token: string,
  estimateId: string
): Promise<void> {
  const admin = createServiceClient();

  const { data: link } = await admin
    .from('portal_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!link?.estimate_id) return;

  const { data: tokenEstimate } = await admin
    .from('estimates')
    .select('id, package_id')
    .eq('id', link.estimate_id)
    .maybeSingle();

  if (!tokenEstimate) return;

  if (estimateId !== tokenEstimate.id) {
    const { data: targetEstimate } = await admin
      .from('estimates')
      .select('id, package_id')
      .eq('id', estimateId)
      .maybeSingle();

    if (
      !targetEstimate ||
      !tokenEstimate.package_id ||
      targetEstimate.package_id !== tokenEstimate.package_id
    ) {
      return;
    }
  }

  await approveGbbOptionWith(admin, estimateId);
  revalidatePath(`/portal/${token}`);
  revalidatePath(`/dashboard/estimates/${estimateId}`);
}
