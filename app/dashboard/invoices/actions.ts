'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { assertTechCapability } from '@/lib/company/require-permission';
import { sendJobInvoice } from '@/lib/invoices/send';

export type InvoiceActionState = {
  error?: string;
  success?: string;
  simulated?: boolean;
};

function revalidateInvoicePaths(jobId: string) {
  revalidatePath('/dashboard/invoices');
  revalidatePath('/dashboard/jobs');
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/dispatch');
}

async function assertCanInvoice(jobId: string) {
  const { supabase, user, profile } = await requireProfile();

  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, assigned_to, invoice_status, payment_status, total, subtotal')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error(error?.message || 'Job not found');
  }

  const office = isOfficeRole(profile.role);
  const assignedTech = job.assigned_to === user.id;
  if (!office && !assignedTech) {
    throw new Error('You cannot invoice this job');
  }

  return { supabase, job, office };
}

export async function sendInvoice(
  jobId: string,
  preferredChannel: 'sms' | 'email' | 'auto' = 'auto'
): Promise<InvoiceActionState> {
  try {
    const perm = await assertTechCapability('send_invoice');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await assertCanInvoice(jobId);
    const result = await sendJobInvoice(supabase, {
      jobId,
      preferredChannel,
    });
    if (!result.ok) return { error: result.error };
    revalidateInvoicePaths(jobId);
    return {
      success: result.success,
      simulated: result.simulated,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Send invoice failed',
    };
  }
}

/** Mark cash or check paid (office or assigned tech). */
export async function recordCashCheckPayment(
  jobId: string,
  method: 'cash' | 'check'
): Promise<InvoiceActionState> {
  try {
    const perm = await assertTechCapability('record_payment');
    if (!perm.ok) return { error: perm.error };
    const { supabase } = await assertCanInvoice(jobId);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('jobs')
      .update({
        invoice_status: 'Sent',
        payment_status: 'Paid',
        payment_method: method,
        updated_at: now,
      })
      .eq('id', jobId);

    if (error) return { error: error.message };

    revalidateInvoicePaths(jobId);
    return {
      success: `Marked paid (${method})`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Payment update failed',
    };
  }
}
