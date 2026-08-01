import type { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { createJobPaymentLink } from '@/lib/stripe';
import { sendAndLogOutboundSms } from '@/lib/messages/send';
import { invoiceSmsBody } from '@/lib/messages/templates';
import { formatMoney } from '@/lib/jobs/totals';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SendInvoiceResult = {
  ok: boolean;
  error?: string;
  success?: string;
  channel?: 'sms' | 'email';
  simulated?: boolean;
  payLink?: string | null;
};

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  );
}

export async function sendJobInvoice(
  supabase: Supabase,
  opts: {
    jobId: string;
    preferredChannel?: 'sms' | 'email' | 'auto';
  }
): Promise<SendInvoiceResult> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, job_number, customer_id, customer_name, total, subtotal, invoice_status, payment_status, stripe_payment_link, stripe_payment_id'
    )
    .eq('id', opts.jobId)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, error: error?.message || 'Job not found' };
  }

  const total = Number(job.total) || 0;
  const subtotal = Number(job.subtotal) || 0;
  const amount = total > 0 ? total : subtotal;
  if (amount <= 0) {
    return {
      ok: false,
      error: 'Add line items with prices before sending an invoice',
    };
  }

  let phone: string | null = null;
  let email: string | null = null;
  if (job.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('phone, email')
      .eq('id', job.customer_id)
      .maybeSingle();
    phone = customer?.phone ?? null;
    email = customer?.email ?? null;
  }

  const preferred = opts.preferredChannel || 'auto';
  let channel: 'sms' | 'email' | null = null;
  if (preferred === 'sms' && phone) channel = 'sms';
  else if (preferred === 'email' && email) channel = 'email';
  else if (preferred === 'auto') {
    if (email) channel = 'email';
    else if (phone) channel = 'sms';
  } else if (preferred === 'sms' && !phone) {
    return { ok: false, error: 'Customer has no phone number' };
  } else if (preferred === 'email' && !email) {
    return { ok: false, error: 'Customer has no email address' };
  }

  if (!channel) {
    return {
      ok: false,
      error: 'Customer needs a phone or email to send the invoice',
    };
  }

  // Fresh Stripe pay link when unpaid (so amount matches current total)
  let payLink = job.stripe_payment_link;
  let stripePaymentId = job.stripe_payment_id;
  let stripeNote = '';

  if (job.payment_status !== 'Paid') {
    const linkResult = await createJobPaymentLink({
      jobId: job.id,
      jobNumber: job.job_number,
      customerName: job.customer_name,
      amountDollars: amount,
    });

    if (linkResult.error) {
      return { ok: false, error: linkResult.error };
    }

    if (linkResult.url) {
      payLink = linkResult.url;
      stripePaymentId = linkResult.paymentLinkId || stripePaymentId;
      stripeNote = ' · Stripe pay link included';
    } else if (linkResult.simulated) {
      payLink = `${appBaseUrl()}/pay/complete?job=${job.id}`;
      stripeNote = ' · Stripe not configured (placeholder link)';
    }
  }

  const amountLabel = formatMoney(amount);
  const jobLabel = job.job_number || job.id.slice(0, 8);
  const bodyText = invoiceSmsBody({
    customerName: job.customer_name,
    amountLabel,
    link: payLink,
  });

  let simulated = false;
  let deliveryError: string | undefined;

  if (channel === 'sms') {
    const result = await sendAndLogOutboundSms(supabase, {
      jobId: job.id,
      customerId: job.customer_id,
      to: phone!,
      body: bodyText,
      kind: 'invoice',
    });
    if (!result.ok) {
      return { ok: false, error: result.error || 'SMS failed' };
    }
    simulated = result.simulated;
  } else {
    const subject = `Invoice ${jobLabel} · ${amountLabel}`;
    const emailResult = await sendEmail({
      to: email!,
      subject,
      text: `${bodyText}\n\nJob: ${jobLabel}\nPay: ${payLink}`,
    });
    if (!emailResult.ok) {
      return { ok: false, error: emailResult.error || 'Email failed' };
    }
    simulated = emailResult.simulated;

    const status = `invoice:${emailResult.simulated ? 'simulated' : 'sent'}`;
    const { error: logError } = await supabase.from('messages').insert({
      job_id: job.id,
      customer_id: job.customer_id,
      channel: 'email',
      direction: 'outbound',
      to_address: email,
      from_address: process.env.RESEND_FROM_EMAIL?.trim() || 'simulated',
      body: bodyText,
      status,
      provider_id: emailResult.id || null,
    });
    if (logError) deliveryError = logError.message;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      invoice_status: 'Sent',
      invoice_sent_at: now,
      payment_status: job.payment_status === 'Paid' ? 'Paid' : 'Unpaid',
      stripe_payment_link: payLink,
      stripe_payment_id: stripePaymentId,
      updated_at: now,
    })
    .eq('id', job.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const via = channel === 'sms' ? phone : email;
  return {
    ok: true,
    channel,
    simulated,
    payLink,
    success: simulated
      ? `Invoice marked Sent · ${channel} logged (delivery not configured) → ${via}${stripeNote}${deliveryError ? ` · log: ${deliveryError}` : ''}`
      : `Invoice sent via ${channel} to ${via}${stripeNote}`,
  };
}
