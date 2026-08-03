'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import {
  approveGbbOptionWith,
  type GbbOptionLabel,
} from '@/lib/estimates/gbb';
import { generateEstimateNumber } from '@/lib/jobs/numbers';
import { computeJobTotals } from '@/lib/jobs/totals';

export type GbbActionState = { error?: string; success?: string };

export type GbbOptionInput = {
  label: GbbOptionLabel;
  headline?: string;
  isRecommended?: boolean;
  items: {
    description: string;
    qty: number;
    unit_price: number;
    taxable: boolean;
  }[];
};

function revalidateEstimatePaths(estimateIds?: string[]) {
  revalidatePath('/dashboard/estimates');
  revalidatePath('/dashboard/estimates/gbb');
  revalidatePath('/dashboard');
  for (const id of estimateIds || []) {
    revalidatePath(`/dashboard/estimates/${id}`);
  }
}

export async function createGbbPackage(input: {
  customerId: string;
  description: string;
  taxRateId: string;
  validUntil?: string | null;
  options: GbbOptionInput[];
}): Promise<GbbActionState & { packageId?: string; estimateIds?: string[] }> {
  const { supabase, user } = await requireOffice();

  if (!input.customerId) return { error: 'Select a customer' };

  const options = input.options.filter((o) =>
    o.items.some((i) => i.description.trim())
  );
  if (options.length < 2) {
    return { error: 'Add line items to at least two options (Good/Better/Best)' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', input.customerId)
    .maybeSingle();
  if (!customer) return { error: 'Customer not found' };

  const { data: tax } = await supabase
    .from('tax_rates')
    .select('id, rate')
    .eq('id', input.taxRateId)
    .maybeSingle();
  if (!tax) return { error: 'Tax rate not found' };

  const packageId = randomUUID();
  const estimateIds: string[] = [];

  for (const option of options) {
    const items = option.items.filter((i) => i.description.trim());
    const totals = computeJobTotals(items, Number(tax.rate) || 0);

    const { data: estimate, error } = await supabase
      .from('estimates')
      .insert({
        estimate_number: generateEstimateNumber(),
        customer_id: customer.id,
        customer_name: customer.name,
        description: input.description?.trim() || null,
        status: 'Draft',
        tax_rate_id: tax.id,
        tax_rate: tax.rate,
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total: totals.total,
        valid_until: input.validUntil || null,
        package_id: packageId,
        option_label: option.label,
        option_headline: option.headline?.trim() || null,
        is_recommended: Boolean(option.isRecommended),
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error || !estimate) {
      return {
        error:
          error?.message.includes('package_id') || error?.code === '42703'
            ? 'Could not create package option. Refresh and try again, or contact support.'
            : error?.message || 'Could not create package option',
      };
    }

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('line_items').insert(
        items.map((item, index) => ({
          estimate_id: estimate.id,
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
          taxable: item.taxable,
          sort_order: index,
        }))
      );
      if (itemsError) return { error: itemsError.message };
    }

    estimateIds.push(estimate.id);
  }

  revalidateEstimatePaths(estimateIds);
  return {
    success: 'Good / Better / Best package created',
    packageId,
    estimateIds,
  };
}

/** Approve one option and reject the other options in its package. */
export async function approveGbbOption(estimateId: string): Promise<GbbActionState> {
  const { supabase } = await requireOffice();
  const result = await approveGbbOptionWith(supabase, estimateId);
  if (result.success) {
    const { data: estimate } = await supabase
      .from('estimates')
      .select('package_id')
      .eq('id', estimateId)
      .maybeSingle();
    revalidateEstimatePaths(
      estimate?.package_id ? undefined : [estimateId]
    );
    revalidatePath('/dashboard/estimates');
  }
  return result;
}
