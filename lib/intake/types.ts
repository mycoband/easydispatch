export type IntakeChannel = 'ai_sms' | 'ai_voice';

export type ReceptionistSettings = {
  greeting: string | null;
  service_area: string | null;
  business_hours_note: string | null;
  escalate_phone: string | null;
  /** E.164 DID that routes inbound SMS/voice to this company */
  twilio_phone: string | null;
};

export const DEFAULT_RECEPTIONIST: ReceptionistSettings = {
  greeting: null,
  service_area: null,
  business_hours_note: null,
  escalate_phone: null,
  twilio_phone: null,
};

export function normalizeReceptionist(raw: unknown): ReceptionistSettings {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (k: string) =>
    typeof o[k] === 'string' && (o[k] as string).trim()
      ? (o[k] as string).trim()
      : null;
  return {
    greeting: str('greeting'),
    service_area: str('service_area'),
    business_hours_note: str('business_hours_note'),
    escalate_phone: str('escalate_phone'),
    twilio_phone: str('twilio_phone'),
  };
}

export type IntakeExtract = {
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  job_type: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  diagnosis: string;
  customer_summary: string | null;
  access_notes: string | null;
  ready: boolean;
  needs_human: boolean;
  reply_to_caller: string;
  summary: string;
};
