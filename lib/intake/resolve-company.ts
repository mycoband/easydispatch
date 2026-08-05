import { createServiceClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/twilio';
import {
  normalizeReceptionist,
  type ReceptionistSettings,
} from '@/lib/intake/types';
import { normalizeModules, type ModuleId } from '@/lib/company/modules';

export type IntakeCompanyContext = {
  companyId: string;
  companyName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  modules: Record<ModuleId, boolean>;
  receptionist: ReceptionistSettings;
};

/**
 * Map inbound Twilio/Vapi "To" number → company_settings.receptionist.twilio_phone.
 * Only matches an explicit inbound DID — never the first shop with the module on
 * (that sent voice jobs to the wrong company).
 */
export async function resolveCompanyForInboundDid(
  toRaw: string | null | undefined
): Promise<IntakeCompanyContext | null> {
  const admin = createServiceClient();
  const to =
    normalizePhone(toRaw) || normalizePhone(process.env.TWILIO_PHONE_NUMBER);
  if (!to) return null;

  const { data: rows } = await admin
    .from('company_settings')
    .select('company_id, name, phone, email, modules, receptionist')
    .not('company_id', 'is', null);

  const match = (rows ?? []).find((row) => {
    const r = normalizeReceptionist(row.receptionist);
    const did = normalizePhone(r.twilio_phone);
    return did && did === to;
  });
  if (match?.company_id) {
    return hydrateContext(admin, match);
  }

  return null;
}

async function hydrateContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  row: {
    company_id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    modules: unknown;
    receptionist: unknown;
  }
): Promise<IntakeCompanyContext | null> {
  if (!row.company_id) return null;
  const mods = normalizeModules(row.modules);
  const receptionist = normalizeReceptionist(row.receptionist);

  const { data: owner } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('company_id', row.company_id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  return {
    companyId: row.company_id,
    companyName: row.name || 'Shop',
    ownerEmail: row.email || null,
    ownerPhone: row.phone || receptionist.escalate_phone || null,
    modules: mods,
    receptionist,
  };
}
