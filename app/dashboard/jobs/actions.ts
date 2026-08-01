'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOffice } from '@/lib/auth';
import { allocateNextJobNumber } from '@/lib/jobs/numbers';
import {
  computeJobTotals,
  fromDatetimeLocalValue,
} from '@/lib/jobs/totals';
import { emptyToNull } from '@/lib/validations/customer';
import {
  jobSchema,
  lineItemsPayloadSchema,
} from '@/lib/validations/job';

export type ActionState = {
  error?: string;
  success?: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function loadTaxRate(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  taxRateId: string
) {
  const { data } = await supabase
    .from('tax_rates')
    .select('id, rate, name')
    .eq('id', taxRateId)
    .maybeSingle();
  return data;
}

async function resolveAssignee(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  assignedTo: string | null
) {
  if (!assignedTo) return { assigned_to: null, assigned_to_name: null };
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', assignedTo)
    .maybeSingle();
  return {
    assigned_to: data?.id ?? null,
    assigned_to_name: data?.full_name ?? null,
  };
}

export async function createJob(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user, profile } = await requireOffice();

  const parsed = jobSchema.safeParse({
    customer_id: formString(formData, 'customer_id'),
    job_number: formString(formData, 'job_number'),
    property_id: formString(formData, 'property_id'),
    equipment_id: formString(formData, 'equipment_id'),
    job_type: formString(formData, 'job_type'),
    priority: formString(formData, 'priority') || 'Medium',
    status: formString(formData, 'status') || 'New',
    assigned_to: formString(formData, 'assigned_to'),
    diagnosis: formString(formData, 'diagnosis'),
    est_hours: formString(formData, 'est_hours'),
    scheduled_start: formString(formData, 'scheduled_start'),
    tax_rate_id: formString(formData, 'tax_rate_id') || 'kcmo-jackson',
    notes: formString(formData, 'notes'),
    internal_notes: formString(formData, 'internal_notes'),
    customer_summary: formString(formData, 'customer_summary'),
    is_callback: formData.get('is_callback') === 'on',
    warranty_flag: formData.get('warranty_flag') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid job' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', parsed.data.customer_id)
    .maybeSingle();

  if (!customer) {
    return { error: 'Customer not found' };
  }

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) {
    return { error: 'Tax rate not found' };
  }

  const assignee = await resolveAssignee(
    supabase,
    emptyToNull(parsed.data.assigned_to)
  );

  let status = parsed.data.status;
  if (assignee.assigned_to && status === 'New') {
    status = 'Scheduled';
  }

  const customNumber = parsed.data.job_number?.trim() || '';
  const jobNumber =
    customNumber ||
    (await allocateNextJobNumber(supabase, profile.company_id));

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      company_id: profile.company_id,
      job_number: jobNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      property_id: emptyToNull(parsed.data.property_id),
      equipment_id: emptyToNull(parsed.data.equipment_id),
      job_type: parsed.data.job_type,
      priority: parsed.data.priority,
      status,
      assigned_to: assignee.assigned_to,
      assigned_to_name: assignee.assigned_to_name,
      diagnosis: emptyToNull(parsed.data.diagnosis),
      est_hours: parsed.data.est_hours ? Number(parsed.data.est_hours) : null,
      scheduled_start: fromDatetimeLocalValue(parsed.data.scheduled_start),
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      notes: emptyToNull(parsed.data.notes),
      internal_notes: emptyToNull(parsed.data.internal_notes),
      customer_summary: emptyToNull(parsed.data.customer_summary),
      is_callback: Boolean(parsed.data.is_callback),
      warranty_flag: Boolean(parsed.data.warranty_flag),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !job) {
    if (error?.message?.toLowerCase().includes('unique')) {
      return {
        error: `Job # / name "${jobNumber}" is already in use. Choose another.`,
      };
    }
    return { error: error?.message || 'Could not create job' };
  }

  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard/calendar');
  revalidatePath('/dashboard');
  redirect(`/dashboard/jobs/${job.id}`);
}

export async function updateJob(
  jobId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, profile } = await requireOffice();

  const parsed = jobSchema.safeParse({
    customer_id: formString(formData, 'customer_id'),
    job_number: formString(formData, 'job_number'),
    property_id: formString(formData, 'property_id'),
    equipment_id: formString(formData, 'equipment_id'),
    job_type: formString(formData, 'job_type'),
    priority: formString(formData, 'priority') || 'Medium',
    status: formString(formData, 'status') || 'New',
    assigned_to: formString(formData, 'assigned_to'),
    diagnosis: formString(formData, 'diagnosis'),
    est_hours: formString(formData, 'est_hours'),
    scheduled_start: formString(formData, 'scheduled_start'),
    tax_rate_id: formString(formData, 'tax_rate_id') || 'kcmo-jackson',
    notes: formString(formData, 'notes'),
    internal_notes: formString(formData, 'internal_notes'),
    customer_summary: formString(formData, 'customer_summary'),
    is_callback: formData.get('is_callback') === 'on',
    warranty_flag: formData.get('warranty_flag') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid job' };
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', parsed.data.customer_id)
    .maybeSingle();

  if (!customer) {
    return { error: 'Customer not found' };
  }

  const tax = await loadTaxRate(supabase, parsed.data.tax_rate_id);
  if (!tax) {
    return { error: 'Tax rate not found' };
  }

  const assignee = await resolveAssignee(
    supabase,
    emptyToNull(parsed.data.assigned_to)
  );

  const { data: existingItems } = await supabase
    .from('line_items')
    .select('qty, unit_price, taxable')
    .eq('job_id', jobId);

  const totals = computeJobTotals(
    (existingItems ?? []).map((i) => ({
      qty: Number(i.qty) || 0,
      unit_price: Number(i.unit_price) || 0,
      taxable: Boolean(i.taxable),
    })),
    Number(tax.rate) || 0
  );

  const customNumber = parsed.data.job_number?.trim() || '';
  let jobNumber = customNumber;
  if (!jobNumber) {
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('job_number')
      .eq('id', jobId)
      .maybeSingle();
    jobNumber =
      existingJob?.job_number?.trim() ||
      (await allocateNextJobNumber(supabase, profile.company_id));
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      job_number: jobNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      property_id: emptyToNull(parsed.data.property_id),
      equipment_id: emptyToNull(parsed.data.equipment_id),
      job_type: parsed.data.job_type,
      priority: parsed.data.priority,
      status: parsed.data.status,
      assigned_to: assignee.assigned_to,
      assigned_to_name: assignee.assigned_to_name,
      diagnosis: emptyToNull(parsed.data.diagnosis),
      est_hours: parsed.data.est_hours ? Number(parsed.data.est_hours) : null,
      scheduled_start: fromDatetimeLocalValue(parsed.data.scheduled_start),
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      notes: emptyToNull(parsed.data.notes),
      internal_notes: emptyToNull(parsed.data.internal_notes),
      customer_summary: emptyToNull(parsed.data.customer_summary),
      is_callback: Boolean(parsed.data.is_callback),
      warranty_flag: Boolean(parsed.data.warranty_flag),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    if (error.message?.toLowerCase().includes('unique')) {
      return {
        error: `Job # / name "${jobNumber}" is already in use. Choose another.`,
      };
    }
    return { error: error.message };
  }

  revalidatePath('/dashboard/jobs');
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath('/dashboard/calendar');
  revalidatePath('/dashboard/dispatch');
  revalidatePath('/dashboard');
  return { success: 'Job updated' };
}

export async function saveJobLineItems(
  jobId: string,
  payloadJson: string
): Promise<ActionState> {
  const { supabase } = await requireOffice();

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
  if (!tax) {
    return { error: 'Tax rate not found' };
  }

  const { error: deleteError } = await supabase
    .from('line_items')
    .delete()
    .eq('job_id', jobId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (parsed.data.items.length > 0) {
    const { error: insertError } = await supabase.from('line_items').insert(
      parsed.data.items.map((item, index) => ({
        job_id: jobId,
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
      // Retry without costing columns if SQL not applied yet
      if (/unit_cost|item_type|column/i.test(insertError.message)) {
        const { error: fallbackErr } = await supabase.from('line_items').insert(
          parsed.data.items.map((item, index) => ({
            job_id: jobId,
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

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      tax_rate_id: tax.id,
      tax_rate: tax.rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (jobError) {
    return { error: jobError.message };
  }

  try {
    const { recalculateJobCosting } = await import(
      '@/lib/jobs/recalculate-costing'
    );
    await recalculateJobCosting(supabase, jobId);
  } catch {
    /* costing optional until SQL applied */
  }

  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard/invoices');
  revalidatePath('/dashboard/reports');
  return { success: 'Line items saved' };
}

export async function deleteJob(jobId: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { error } = await supabase.from('jobs').delete().eq('id', jobId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard');
  redirect('/dashboard/jobs');
}
