import { normalizePhone } from '@/lib/twilio';

/** Pull a phone string from mixed Vapi / Twilio-shaped values. */
function asPhone(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return normalizePhone(value) || null;
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const key of ['number', 'phoneNumber', 'phone', 'twilioPhoneNumber']) {
      if (typeof o[key] === 'string' && (o[key] as string).trim()) {
        return normalizePhone(o[key] as string) || null;
      }
    }
  }
  return null;
}

/**
 * Resolve the shop DID (Twilio "To") from a Vapi end-of-call payload.
 * Avoids String(object) → "[object Object]" which breaks normalizePhone.
 */
export function resolveVapiToPhone(
  call: Record<string, unknown>,
  message: Record<string, unknown>,
  payload: Record<string, unknown>
): string | null {
  const candidates: unknown[] = [
    call.phoneNumber,
    message.phoneNumber,
    payload.phoneNumber,
    call.phoneNumberId,
    (call as { transport?: { phoneNumber?: unknown } }).transport?.phoneNumber,
  ];
  for (const c of candidates) {
    const phone = asPhone(c);
    if (phone) return phone;
  }
  return normalizePhone(process.env.TWILIO_PHONE_NUMBER);
}

/** Caller / customer phone from a Vapi payload. */
export function resolveVapiFromPhone(
  call: Record<string, unknown>,
  message: Record<string, unknown>
): string | null {
  const customer = (call.customer || message.customer || {}) as Record<
    string,
    unknown
  >;
  return (
    asPhone(customer.number) ||
    asPhone(customer.phone) ||
    asPhone(call.customerNumber) ||
    asPhone(message.phone) ||
    null
  );
}
