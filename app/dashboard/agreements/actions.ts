'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOffice } from '@/lib/auth';
import { computeJobTotals } from '@/lib/jobs/totals';
import { allocateNextJobNumber } from '@/lib/jobs/numbers';
import {
  normalizeBillingInterval,
  type BillingInterval,
} from '@/lib/agreements/billing';
import { createPmJobForAgreement } from '@/lib/agreements/create-pm-job';
import { emptyToNull } from '@/lib/validations/customer';

export type ActionState = { error?: string; success?: string };

function formString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

/** Advance a bill date by one billing cycle (monthly/quarterly/yearly). */
function advanceBillDate(
  from: string | null,
  interval: BillingInterval
): string | null {
  if (interval === 'none') return from;
  const base = from ? new Date(`${from}T12:00:00`) : new Date();
  if (interval === 'yearly') base.setFullYear(base.getFullYear() + 1);
  else if (interval === 'quarterly') base.setMonth(base.getMonth() + 3);
  else base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export async function createAgreement(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const customerId = formString(formData, 'customer_id');
  const planName = formString(formData, 'plan_name').trim();
  if (!customerId || !planName) return { error: 'Customer and plan required' };

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return { error: 'Customer not found' };

  const visits = Number(formString(formData, 'visits_per_year')) || 4;
  const monthly = Number(formString(formData, 'monthly_amount')) || 0;
  const agreementType =
    formString(formData, 'agreement_type') === 'membership'
      ? 'membership'
      : 'pm';
  const billingInterval = normalizeBillingInterval(
    formString(formData, 'billing_interval')
  );
  const nextBillDate =
    emptyToNull(formString(formData, 'next_bill_date')) ||
    emptyToNull(formString(formData, 'next_due_date'));

  const { error } = await supabase.from('service_agreements').insert({
    customer_id: customer.id,
    customer_name: customer.name,
    plan_name: planName,
    visits_per_year: visits,
    monthly_amount: monthly,
    next_due_date: emptyToNull(formString(formData, 'next_due_date')),
    status: formString(formData, 'status') || 'Active',
    notes: emptyToNull(formString(formData, 'notes')),
    agreement_type: agreementType,
    billing_interval: billingInterval,
    next_bill_date: nextBillDate,
  });

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agreements');
  redirect('/dashboard/agreements');
}

export async function updateAgreement(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const visits = Number(formString(formData, 'visits_per_year')) || 4;
  const { error } = await supabase
    .from('service_agreements')
    .update({
      plan_name: formString(formData, 'plan_name').trim(),
      visits_per_year: visits,
      monthly_amount: Number(formString(formData, 'monthly_amount')) || 0,
      next_due_date: emptyToNull(formString(formData, 'next_due_date')),
      status: formString(formData, 'status') || 'Active',
      notes: emptyToNull(formString(formData, 'notes')),
      agreement_type:
        formString(formData, 'agreement_type') === 'membership'
          ? 'membership'
          : 'pm',
      billing_interval: normalizeBillingInterval(
        formString(formData, 'billing_interval')
      ),
      next_bill_date: emptyToNull(formString(formData, 'next_bill_date')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agreements');
  return { success: 'Saved' };
}

export async function createPmJobFromAgreement(
  agreementId: string
): Promise<ActionState> {
  const { supabase, user, profile } = await requireOffice();

  const { data: agreement, error } = await supabase
    .from('service_agreements')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();

  if (error || !agreement) {
    return { error: error?.message || 'Agreement not found' };
  }

  const result = await createPmJobForAgreement(supabase, agreement, {
    companyId: profile.company_id,
    createdBy: user.id,
  });

  if (!result.jobId) {
    return { error: result.error || 'Could not create PM job' };
  }

  revalidatePath('/dashboard/agreements');
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard/calendar');
  redirect(`/dashboard/jobs/${result.jobId}`);
}

/** Mark a membership as billed and advance next_bill_date by its interval. */
export async function markAgreementBilled(id: string): Promise<ActionState> {
  const { supabase } = await requireOffice();

  const { data: agreement, error } = await supabase
    .from('service_agreements')
    .select('id, next_bill_date, billing_interval')
    .eq('id', id)
    .maybeSingle();

  if (error || !agreement) {
    return { error: error?.message || 'Agreement not found' };
  }

  const interval = normalizeBillingInterval(agreement.billing_interval || 'monthly');
  const nextBillDate = advanceBillDate(agreement.next_bill_date, interval);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('service_agreements')
    .update({
      last_billed_at: now,
      next_bill_date: nextBillDate,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) return { error: updateError.message };

  revalidatePath('/dashboard/agreements');
  return { success: 'Marked billed' };
}

/** Create a Completed job for a membership's monthly/quarterly/yearly fee and mark it billed. */
export async function createMembershipInvoiceJob(
  agreementId: string
): Promise<ActionState> {
  const { supabase, user, profile } = await requireOffice();

  const { data: agreement, error } = await supabase
    .from('service_agreements')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();

  if (error || !agreement) {
    return { error: error?.message || 'Agreement not found' };
  }

  const amount = Number(agreement.monthly_amount) || 0;
  const totals = computeJobTotals(
    [{ qty: 1, unit_price: amount, taxable: false }],
    0
  );
  const jobNumber = await allocateNextJobNumber(supabase, profile.company_id);

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      company_id: profile.company_id,
      job_number: jobNumber,
      customer_id: agreement.customer_id,
      customer_name: agreement.customer_name,
      job_type: 'Membership billing',
      priority: 'Low',
      status: 'Completed',
      diagnosis: `Membership billing: ${agreement.plan_name}`,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      tax_rate_id: 'none',
      tax_rate: 0,
      internal_notes: `Auto-created membership billing job for ${agreement.plan_name}`,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return { error: jobError?.message || 'Could not create billing job' };
  }

  const { error: itemError } = await supabase.from('line_items').insert({
    job_id: job.id,
    description: `${agreement.plan_name} — membership billing`,
    qty: 1,
    unit_price: amount,
    taxable: false,
    sort_order: 0,
  });

  if (itemError) return { error: itemError.message };

  const interval = normalizeBillingInterval(agreement.billing_interval || 'monthly');
  const nextBillDate = advanceBillDate(agreement.next_bill_date, interval);
  const now = new Date().toISOString();

  await supabase
    .from('service_agreements')
    .update({
      last_billed_at: now,
      next_bill_date: nextBillDate,
      last_pm_job_id: job.id,
      updated_at: now,
    })
    .eq('id', agreementId);

  revalidatePath('/dashboard/agreements');
  revalidatePath('/dashboard/jobs');
  redirect(`/dashboard/jobs/${job.id}`);
}

export async function deleteAgreement(id: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { error } = await supabase
    .from('service_agreements')
    .delete()
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/agreements');
  return { success: 'Deleted' };
}
