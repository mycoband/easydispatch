import { createServiceClient } from '@/lib/supabase/admin';
import { sendSms, normalizePhone } from '@/lib/twilio';
import type { IntakeCompanyContext } from '@/lib/intake/resolve-company';

export async function escalateToHuman(opts: {
  ctx: IntakeCompanyContext;
  fromPhone: string;
  channel: 'sms' | 'voice';
  reason: string;
}): Promise<string> {
  const admin = createServiceClient();
  const escalate = normalizePhone(opts.ctx.receptionist.escalate_phone);
  const owner = normalizePhone(opts.ctx.ownerPhone);

  await admin.from('intake_events').insert({
    company_id: opts.ctx.companyId,
    channel: opts.channel,
    from_phone: opts.fromPhone,
    event_type: 'escalate_human',
    payload: { reason: opts.reason },
  });

  const alertTo = escalate || owner;
  if (alertTo) {
    await sendSms(
      alertTo,
      `${opts.ctx.companyName}: caller ${opts.fromPhone} needs a person (${opts.channel}). ${opts.reason}`
    );
  }

  if (opts.channel === 'sms') {
    return escalate
      ? `I'm connecting you with our office. Someone will text or call you shortly at this number.`
      : `I've alerted the office — someone will get back to you as soon as possible.`;
  }
  return 'Please hold — we are notifying the office to call you back right away.';
}
