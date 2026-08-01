'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOffice } from '@/lib/auth';
import {
  assertCanBuildEstimateOnJob,
  assertCanEditEstimate,
  getEstimateActor,
  loadJobForEstimate,
} from '@/lib/estimates/access';
import {
  allocateNextJobNumber,
  generateEstimateNumber,
} from '@/lib/jobs/numbers';
import { computeJobTotals } from '@/lib/jobs/totals';
import { emptyToNull } from '@/lib/validations/customer';
import { estimateSchema } from '@/lib/validations/estimate';
import { lineItemsPayloadSchema } from '@/lib/validations/job';

export type ActionState = {
  error?: string;
  success?: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function loadTaxRate(
  supabase: Awaited<ReturnType<typeof getEstimateActor>>['supabase'],
  taxRateId: string
) {
  const { data } = await supabase
    .from('tax_rates')
    .select('id, rate, name')
    .eq('id', taxRateId)
    .maybeSingle();
  return data;
}

function revalidateEstimates(id?: string, jobId?: string | null) {
  revalidatePath('/dashboard/estimates');
  revalidatePath('/dashboard');
  if (id) {
    revalidatePath(`/dashboard/estimates/${id}`);
    revalidatePath(`/tech/estimates/${id}`);
  }
  if (jobId) {
    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath(`/tech/jobs/${jobId}`);
  }
}

export async function createEstimateWithItems(input: {
  customer_id: string;
  description: string;
  tax_rate_id: string;
  valid_until?: string | null;
  job_id?: string | null;
  items: {
    description: string;
    qty: number;
    unit_price: number;
    taxable: boolean;
    sort_order?: number;
  }[];
}): Promise<ActionState & { id?: string }> {
  const actor = await getEstimateActor();
  const { supabase, user, profile } = actor;

  let jobId = input.job_id || null;
  let customerId = input.customer_id;

  if (jobId) {
    const job = await loadJobForEstimate(supabase, jobId);
    if (!job) return { error: 'Job not found' };
    const denied = await assertCanBuildEstimateOnJob(actor, job);
    if (denied) return { error: denied };
    if (!job.customer_id) return { error: 'Job has no customer' };
    customerId = job.customer_id;
  } else if (!actor.isOffice) {
    return { error: 'Technicians must create estimates from a job' };
  }

  const parsed = estimateSchema.safeParse({
    customer_id: customerId,
    description: input.description,
    status: 'Draft',
    tax_rate_id: input.tax_rate_id || 'kcmo-jackson',
    valid_until: input.valid_until || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid estimate' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', parsed.data.customer_id)
    .maybeSingle();

  if (!customer) return { error: 'Customer not found' };

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) return { error: 'Tax rate not found' };

  const items = input.items.filter((i) => i.description.trim());
  const totals = computeJobTotals(items, Number(tax.rate) || 0);

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      company_id: profile.company_id,
      estimate_number: generateEstimateNumber(),
      customer_id: customer.id,
      customer_name: customer.name,
      job_id: jobId,
      description: parsed.data.description,
      status: 'Draft',
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      valid_until: emptyToNull(parsed.data.valid_until),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !estimate) {
    return { error: error?.message || 'Could not create estimate' };
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('line_items').insert(
      items.map((item, index) => ({
        company_id: profile.company_id,
        estimate_id: estimate.id,
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        taxable: item.taxable,
        sort_order: item.sort_order ?? index,
      }))
    );
    if (itemsError) return { error: itemsError.message };
  }

  revalidateEstimates(estimate.id, jobId);
  return { success: 'Estimate created', id: estimate.id };
}

export async function createEstimate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user, profile } = await requireOffice();
  const jobId = emptyToNull(formString(formData, 'job_id'));

  const parsed = estimateSchema.safeParse({
    customer_id: formString(formData, 'customer_id'),
    description: formString(formData, 'description'),
    status: formString(formData, 'status') || 'Draft',
    tax_rate_id: formString(formData, 'tax_rate_id') || 'kcmo-jackson',
    valid_until: formString(formData, 'valid_until'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid estimate' };
  }

  let customerId = parsed.data.customer_id;
  if (jobId) {
    const job = await loadJobForEstimate(supabase, jobId);
    if (!job?.customer_id) return { error: 'Job not found or has no customer' };
    customerId = job.customer_id;
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .maybeSingle();

  if (!customer) return { error: 'Customer not found' };

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) return { error: 'Tax rate not found' };

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      company_id: profile.company_id,
      estimate_number: generateEstimateNumber(),
      customer_id: customer.id,
      customer_name: customer.name,
      job_id: jobId,
      description: parsed.data.description,
      status: parsed.data.status,
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      valid_until: emptyToNull(parsed.data.valid_until),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !estimate) {
    return { error: error?.message || 'Could not create estimate' };
  }

  revalidateEstimates(estimate.id, jobId);
  redirect(`/dashboard/estimates/${estimate.id}`);
}

export async function updateEstimate(
  estimateId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await getEstimateActor();
  const { supabase } = actor;

  const { data: existing } = await supabase
    .from('estimates')
    .select('id, job_id, company_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (!existing) return { error: 'Estimate not found' };

  const denied = await assertCanEditEstimate(actor, existing);
  if (denied) return { error: denied };

  const parsed = estimateSchema.safeParse({
    customer_id: formString(formData, 'customer_id'),
    description: formString(formData, 'description'),
    status: formString(formData, 'status') || 'Draft',
    tax_rate_id: formString(formData, 'tax_rate_id') || 'kcmo-jackson',
    valid_until: formString(formData, 'valid_until'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid estimate' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', parsed.data.customer_id)
    .maybeSingle();

  if (!customer) return { error: 'Customer not found' };

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) return { error: 'Tax rate not found' };

  const { data: existingItems } = await supabase
    .from('line_items')
    .select('qty, unit_price, taxable')
    .eq('estimate_id', estimateId);

  const totals = computeJobTotals(
    (existingItems ?? []).map((i) => ({
      qty: Number(i.qty) || 0,
      unit_price: Number(i.unit_price) || 0,
      taxable: Boolean(i.taxable),
    })),
    Number(tax.rate) || 0
  );

  const { error } = await supabase
    .from('estimates')
    .update({
      customer_id: customer.id,
      customer_name: customer.name,
      description: parsed.data.description,
      status: parsed.data.status,
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      valid_until: emptyToNull(parsed.data.valid_until),
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);

  if (error) return { error: error.message };

  revalidateEstimates(estimateId, existing.job_id);
  return { success: 'Estimate updated' };
}

export async function saveEstimateLineItems(
  estimateId: string,
  payloadJson: string
): Promise<ActionState> {
  const actor = await getEstimateActor();
  const { supabase, profile } = actor;

  const { data: existing } = await supabase
    .from('estimates')
    .select('id, job_id, company_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (!existing) return { error: 'Estimate not found' };

  const denied = await assertCanEditEstimate(actor, existing);
  if (denied) return { error: denied };

  let raw: unknown;
  try {
    raw = JSON.parse(payloadJson);
  } catch {
    return { error: 'Invalid line items payload' };
  }

  const parsed = lineItemsPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid line items' };
  }

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) return { error: 'Tax rate not found' };

  const { error: deleteError } = await supabase
    .from('line_items')
    .delete()
    .eq('estimate_id', estimateId);

  if (deleteError) return { error: deleteError.message };

  if (parsed.data.items.length > 0) {
    const { error: insertError } = await supabase.from('line_items').insert(
      parsed.data.items.map((item, index) => ({
        company_id: profile.company_id,
        estimate_id: estimateId,
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost ?? 0,
        item_type: item.item_type || 'other',
        taxable: item.taxable,
        sort_order: item.sort_order ?? index,
      }))
    );
    if (insertError) {
      if (/unit_cost|item_type|column/i.test(insertError.message)) {
        const { error: fallbackErr } = await supabase.from('line_items').insert(
          parsed.data.items.map((item, index) => ({
            company_id: profile.company_id,
            estimate_id: estimateId,
            description: item.description,
            qty: item.qty,
            unit_price: item.unit_price,
            taxable: item.taxable,
            sort_order: item.sort_order ?? index,
          }))
        );
        if (fallbackErr) return { error: fallbackErr.message };
      } else {
        return { error: insertError.message };
      }
    }
  }

  const totals = computeJobTotals(parsed.data.items, Number(tax.rate) || 0);

  const { error: updateError } = await supabase
    .from('estimates')
    .update({
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);

  if (updateError) return { error: updateError.message };

  revalidateEstimates(estimateId, existing.job_id);
  return { success: 'Line items saved' };
}

export async function markEstimateSent(
  estimateId: string
): Promise<ActionState> {
  const actor = await getEstimateActor();
  const { supabase } = actor;

  const { data: existing } = await supabase
    .from('estimates')
    .select('id, job_id, company_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (!existing) return { error: 'Estimate not found' };

  const denied = await assertCanEditEstimate(actor, existing);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from('estimates')
    .update({
      status: 'Sent',
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);

  if (error) return { error: error.message };
  revalidateEstimates(estimateId, existing.job_id);
  return { success: 'Marked as Sent' };
}

/**
 * If estimate.job_id is set: copy line items onto that job (apply).
 * Otherwise: create a new job (legacy convert flow).
 */
export async function convertEstimateToJob(
  estimateId: string
): Promise<ActionState> {
  const actor = await getEstimateActor();
  const { supabase, user, profile } = actor;

  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimateId)
    .maybeSingle();

  if (error || !estimate) {
    return { error: error?.message || 'Estimate not found' };
  }

  const denied = await assertCanEditEstimate(actor, estimate);
  if (denied) return { error: denied };

  if (estimate.converted_job_id) {
    return { error: 'Already applied / converted to a job' };
  }

  if (!estimate.customer_id) {
    return { error: 'Estimate has no customer' };
  }

  const { data: items } = await supabase
    .from('line_items')
    .select(
      'description, qty, unit_price, unit_cost, item_type, taxable, sort_order'
    )
    .eq('estimate_id', estimateId)
    .order('sort_order', { ascending: true });

  // Apply onto linked job
  if (estimate.job_id) {
    const job = await loadJobForEstimate(supabase, estimate.job_id);
    if (!job) return { error: 'Linked job not found' };

    if ((items ?? []).length > 0) {
      const { error: itemsError } = await supabase.from('line_items').insert(
        (items ?? []).map((item, index) => ({
          company_id: profile.company_id,
          job_id: job.id,
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
          unit_cost: Number(item.unit_cost) || 0,
          item_type: item.item_type || 'other',
          taxable: item.taxable,
          sort_order: item.sort_order ?? index,
        }))
      );
      if (itemsError) return { error: itemsError.message };
    }

    // Refresh job totals from all line items
    const { data: jobItems } = await supabase
      .from('line_items')
      .select('qty, unit_price, taxable')
      .eq('job_id', job.id);
    const taxRate = Number(estimate.tax_rate) || 0;
    const totals = computeJobTotals(
      (jobItems ?? []).map((i) => ({
        qty: Number(i.qty) || 0,
        unit_price: Number(i.unit_price) || 0,
        taxable: Boolean(i.taxable),
      })),
      taxRate
    );

    await supabase
      .from('jobs')
      .update({
        tax_rate_id: estimate.tax_rate_id,
        tax_rate: estimate.tax_rate,
        subtotal: totals.subtotal,
        tax_amount: totals.tax_amount,
        total: totals.total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    try {
      const { recalculateJobCosting } = await import(
        '@/lib/jobs/recalculate-costing'
      );
      await recalculateJobCosting(supabase, job.id);
    } catch {
      /* optional */
    }

    await supabase
      .from('estimates')
      .update({
        status: 'Approved',
        converted_job_id: job.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId);

    revalidateEstimates(estimateId, job.id);
    revalidatePath('/dashboard/jobs');
    revalidatePath('/tech');

    if (actor.isOffice) {
      redirect(`/dashboard/jobs/${job.id}`);
    }
    redirect(`/tech/jobs/${job.id}`);
  }

  // Legacy: create a new job from the estimate
  if (!actor.isOffice) {
    return { error: 'Link this estimate to a job before applying it' };
  }

  const jobNumber = await allocateNextJobNumber(supabase, profile.company_id);

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      company_id: profile.company_id,
      job_number: jobNumber,
      customer_id: estimate.customer_id,
      customer_name: estimate.customer_name,
      job_type: 'From estimate',
      priority: 'Medium',
      status: 'New',
      diagnosis: estimate.description,
      tax_rate_id: estimate.tax_rate_id,
      tax_rate: estimate.tax_rate,
      subtotal: estimate.subtotal,
      tax_amount: estimate.tax_amount,
      total: estimate.total,
      notes: `Converted from ${estimate.estimate_number || 'estimate'}`,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return { error: jobError?.message || 'Could not create job' };
  }

  if ((items ?? []).length > 0) {
    const { error: itemsError } = await supabase.from('line_items').insert(
      (items ?? []).map((item, index) => ({
        company_id: profile.company_id,
        job_id: job.id,
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        unit_cost: Number(item.unit_cost) || 0,
        item_type: item.item_type || 'other',
        taxable: item.taxable,
        sort_order: item.sort_order ?? index,
      }))
    );
    if (itemsError) {
      return { error: itemsError.message };
    }
  }

  try {
    const { recalculateJobCosting } = await import(
      '@/lib/jobs/recalculate-costing'
    );
    await recalculateJobCosting(supabase, job.id);
  } catch {
    /* optional */
  }

  await supabase
    .from('estimates')
    .update({
      status: 'Approved',
      job_id: job.id,
      converted_job_id: job.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);

  revalidateEstimates(estimateId, job.id);
  revalidatePath('/dashboard/jobs');
  revalidatePath(`/dashboard/jobs/${job.id}`);
  redirect(`/dashboard/jobs/${job.id}`);
}

export async function deleteEstimate(
  estimateId: string
): Promise<ActionState> {
  const actor = await getEstimateActor();
  const { supabase } = actor;

  const { data: existing } = await supabase
    .from('estimates')
    .select('id, job_id, company_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (!existing) return { error: 'Estimate not found' };

  const denied = await assertCanEditEstimate(actor, existing);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from('estimates')
    .delete()
    .eq('id', estimateId);
  if (error) return { error: error.message };

  revalidateEstimates(undefined, existing.job_id);
  if (actor.isOffice) {
    redirect('/dashboard/estimates');
  }
  if (existing.job_id) {
    redirect(`/tech/jobs/${existing.job_id}`);
  }
  redirect('/tech');
}

export async function linkEstimateToJob(
  estimateId: string,
  jobId: string
): Promise<ActionState> {
  const { supabase } = await requireOffice();

  const { data: estimate } = await supabase
    .from('estimates')
    .select('id, customer_id')
    .eq('id', estimateId)
    .maybeSingle();
  if (!estimate) return { error: 'Estimate not found' };

  const job = await loadJobForEstimate(supabase, jobId);
  if (!job) return { error: 'Job not found' };
  if (
    estimate.customer_id &&
    job.customer_id &&
    estimate.customer_id !== job.customer_id
  ) {
    return { error: 'Estimate and job belong to different customers' };
  }

  const { error } = await supabase
    .from('estimates')
    .update({
      job_id: jobId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);

  if (error) return { error: error.message };
  revalidateEstimates(estimateId, jobId);
  return { success: 'Estimate linked to job' };
}
