import { createServiceClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { sendSms, normalizePhone } from '@/lib/twilio';
import type { IntakeChannel } from '@/lib/intake/types';

/** Notify office that an undated intake job needs scheduling. */
export async function notifyOfficeIntakeJob(opts: {
  companyId: string;
  companyName: string;
  jobId: string;
  customerName: string;
  channel: IntakeChannel;
  summary: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  merged?: boolean;
}): Promise<void> {
  const admin = createServiceClient();
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://easydispatch.app'
  ).replace(/\/$/, '');
  const href = `${appUrl}/dashboard/jobs/${opts.jobId}`;
  const channelLabel = opts.channel === 'ai_sms' ? 'SMS' : 'phone';
  const verb = opts.merged ? 'updated' : 'created';
  const body = `AI receptionist ${verb} a job for ${opts.customerName} via ${channelLabel}. Needs scheduling.\n${opts.summary}\n${href}`;

  await admin.from('intake_events').insert({
    company_id: opts.companyId,
    channel: opts.channel === 'ai_sms' ? 'sms' : 'voice',
    event_type: opts.merged ? 'job_merged' : 'job_created',
    job_id: opts.jobId,
    payload: {
      summary: opts.summary,
      customer_name: opts.customerName,
    },
  });

  await admin.from('messages').insert({
    company_id: opts.companyId,
    job_id: opts.jobId,
    channel: 'system',
    direction: 'inbound',
    to_address: 'office',
    body,
    status: 'intake:needs_schedule',
  });

  if (opts.ownerEmail) {
    await sendEmail({
      to: opts.ownerEmail,
      subject: `${opts.companyName}: new job needs scheduling`,
      text: body,
    });
  }

  const smsTo = normalizePhone(opts.ownerPhone);
  if (smsTo) {
    await sendSms(
      smsTo,
      `${opts.companyName}: AI intake — schedule ${opts.customerName}. ${href}`
    );
  }
}
