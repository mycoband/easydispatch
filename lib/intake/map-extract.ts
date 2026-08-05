import type { IntakeConversationExtract } from '@/lib/grok';
import type { IntakeExtract } from '@/lib/intake/types';

export function mapGrokIntake(
  raw: IntakeConversationExtract,
  fallbackPhone?: string | null
): IntakeExtract {
  return {
    customer_name: raw.customer_name || 'Caller',
    phone: raw.phone || fallbackPhone || null,
    email: raw.email ?? null,
    address: raw.address ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    zip: raw.zip ?? null,
    job_type: raw.job_type || 'Service call',
    priority: raw.priority,
    diagnosis: raw.diagnosis || 'Service request from AI receptionist',
    customer_summary: raw.customer_summary ?? null,
    access_notes: raw.access_notes ?? null,
    ready: raw.ready,
    needs_human: raw.needs_human,
    reply_to_caller: raw.reply_to_caller,
    summary: raw.summary || 'AI intake',
  };
}
