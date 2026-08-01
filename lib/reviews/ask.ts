import { createServiceClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { loadCompanySettingsAdmin } from '@/lib/company';
import { isModuleEnabled } from '@/lib/company/modules';
import { reviewAskEmail } from '@/lib/messages/templates';

export type ReviewAskResult = {
  sent: boolean;
  skipped?: string;
  error?: string;
  simulated?: boolean;
};

/**
 * Email customer a review link after job is Paid + Completed.
 * Idempotent via jobs.review_asked_at (or messages status fallback).
 * Email only — no Twilio.
 */
export async function maybeSendReviewAsk(jobId: string): Promise<ReviewAskResult> {
  const admin = createServiceClient();

  const { data: job, error } = await admin
    .from('jobs')
    .select(
      'id, job_number, customer_id, customer_name, status, payment_status, company_id, review_asked_at'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    return { sent: false, error: error?.message || 'Job not found' };
  }

  if (job.payment_status !== 'Paid') {
    return { sent: false, skipped: 'not_paid' };
  }
  if (job.status !== 'Completed') {
    return { sent: false, skipped: 'not_completed' };
  }

  // Already asked (column may be missing — ignore)
  if ((job as { review_asked_at?: string | null }).review_asked_at) {
    return { sent: false, skipped: 'already_asked' };
  }

  const { data: prior } = await admin
    .from('messages')
    .select('id')
    .eq('job_id', jobId)
    .eq('status', 'review:sent')
    .limit(1)
    .maybeSingle();
  if (prior) {
    return { sent: false, skipped: 'already_asked' };
  }

  let companyId = (job as { company_id?: string | null }).company_id || null;
  if (!companyId && job.customer_id) {
    const { data: cust } = await admin
      .from('customers')
      .select('company_id, email')
      .eq('id', job.customer_id)
      .maybeSingle();
    companyId = cust?.company_id ?? null;
  }

  const company = await loadCompanySettingsAdmin(companyId);
  if (!isModuleEnabled(company.modules, 'review_ask')) {
    return { sent: false, skipped: 'module_off' };
  }

  const reviewUrl = company.google_review_url?.trim() || '';
  if (!reviewUrl) {
    return { sent: false, skipped: 'no_review_url' };
  }

  let email: string | null = null;
  if (job.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', job.customer_id)
      .maybeSingle();
    email = customer?.email?.trim() || null;
  }
  if (!email) {
    return { sent: false, skipped: 'no_customer_email' };
  }

  const { subject, text, html } = reviewAskEmail({
    customerName: job.customer_name,
    companyName: company.name,
    reviewUrl,
    jobNumber: job.job_number,
  });

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.ok) {
    return { sent: false, error: result.error || 'Email failed' };
  }

  const now = new Date().toISOString();
  await admin.from('messages').insert({
    job_id: job.id,
    customer_id: job.customer_id,
    channel: 'email',
    direction: 'outbound',
    to_address: email,
    from_address: 'system',
    body: text,
    status: 'review:sent',
    provider_id: result.id || null,
  });

  const { error: askErr } = await admin
    .from('jobs')
    .update({ review_asked_at: now, updated_at: now })
    .eq('id', job.id);
  if (askErr && !/review_asked_at|column|schema cache/i.test(askErr.message)) {
    // non-fatal — message log is the idempotency fallback
    console.warn('review_asked_at update:', askErr.message);
  }

  return { sent: true, simulated: result.simulated };
}
