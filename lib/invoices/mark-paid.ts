import { createServiceClient } from '@/lib/supabase/admin';
import { formatMoney } from '@/lib/jobs/totals';

export type MarkPaidResult = {
  ok: boolean;
  alreadyPaid?: boolean;
  error?: string;
  jobId?: string;
};

/** Mark job Paid from Stripe webhook (service role). Office-only notification via messages. */
export async function markJobPaidFromStripe(opts: {
  jobId: string;
  stripePaymentId: string | null;
  amountCents?: number | null;
}): Promise<MarkPaidResult> {
  const admin = createServiceClient();

  const { data: job, error } = await admin
    .from('jobs')
    .select(
      'id, job_number, customer_id, customer_name, total, payment_status, stripe_payment_id'
    )
    .eq('id', opts.jobId)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: error?.message || 'Job not found', jobId: opts.jobId };
  }

  if (job.payment_status === 'Paid') {
    return { ok: true, alreadyPaid: true, jobId: job.id };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from('jobs')
    .update({
      payment_status: 'Paid',
      payment_method: 'Card (online)',
      invoice_status: 'Sent',
      stripe_payment_id: opts.stripePaymentId || job.stripe_payment_id,
      updated_at: now,
    })
    .eq('id', job.id);

  if (updateError) {
    return { ok: false, error: updateError.message, jobId: job.id };
  }

  const amountLabel =
    opts.amountCents != null
      ? formatMoney(opts.amountCents / 100)
      : formatMoney(Number(job.total) || 0);

  // Office-only alert (tech is not notified)
  await admin.from('messages').insert({
    job_id: job.id,
    customer_id: job.customer_id,
    channel: 'email',
    direction: 'inbound',
    to_address: 'office',
    from_address: 'stripe',
    body: `Payment received: ${job.customer_name || 'Customer'} · Job ${job.job_number || job.id.slice(0, 8)} · ${amountLabel}`,
    status: 'payment:paid',
    provider_id: opts.stripePaymentId,
  });

  return { ok: true, jobId: job.id };
}
