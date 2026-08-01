import twilio from 'twilio';

export type SmsSendResult = {
  ok: boolean;
  sid?: string;
  status: string;
  simulated: boolean;
  error?: string;
};

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/** Normalize to E.164-ish US number when possible. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * Send SMS via Twilio. If credentials are missing, returns a simulated success
 * so local/dev flows still log to `messages`.
 */
export async function sendSms(
  to: string,
  body: string
): Promise<SmsSendResult> {
  const config = getTwilioConfig();
  if (!config) {
    return {
      ok: true,
      status: 'simulated',
      simulated: true,
      sid: `sim_${Date.now()}`,
    };
  }

  try {
    const client = twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({
      to,
      from: config.from,
      body,
    });
    return {
      ok: true,
      sid: message.sid,
      status: message.status || 'queued',
      simulated: false,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'failed',
      simulated: false,
      error: err instanceof Error ? err.message : 'Twilio send failed',
    };
  }
}

export function twilioConfigured() {
  return Boolean(getTwilioConfig());
}
