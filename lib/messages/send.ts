import { createClient } from '@/lib/supabase/server';
import { normalizePhone, sendSms } from '@/lib/twilio';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type OutboundMessageInput = {
  jobId?: string | null;
  customerId?: string | null;
  to: string;
  body: string;
  /** Optional label stored in status prefix for filtering, e.g. omw / reminder / invoice */
  kind?: string;
};

export type OutboundMessageResult = {
  ok: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
  to?: string;
  status?: string;
};

export async function sendAndLogOutboundSms(
  supabase: Supabase,
  input: OutboundMessageInput
): Promise<OutboundMessageResult> {
  const to = normalizePhone(input.to);
  if (!to) {
    return { ok: false, simulated: false, error: 'Invalid or missing phone number' };
  }

  const result = await sendSms(to, input.body);
  const statusBase = result.ok
    ? result.simulated
      ? 'simulated'
      : result.status || 'sent'
    : 'failed';
  const status = input.kind ? `${input.kind}:${statusBase}` : statusBase;

  const { data: row, error } = await supabase
    .from('messages')
    .insert({
      job_id: input.jobId || null,
      customer_id: input.customerId || null,
      channel: 'sms',
      direction: 'outbound',
      to_address: to,
      from_address: process.env.TWILIO_PHONE_NUMBER?.trim() || 'simulated',
      body: input.body,
      status,
      provider_id: result.sid || null,
    })
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      simulated: result.simulated,
      error: error.message,
      to,
      status,
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      simulated: false,
      messageId: row?.id,
      error: result.error || 'SMS failed',
      to,
      status,
    };
  }

  return {
    ok: true,
    simulated: result.simulated,
    messageId: row?.id,
    to,
    status,
  };
}
