import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import {
  normalizeModules,
  type CompanyModules,
  type ModuleId,
} from '@/lib/company/modules';
import {
  normalizeRolePermissions,
  type RolePermissions,
} from '@/lib/company/permissions';
import {
  DEFAULT_COSTING,
  normalizeCosting,
  type CostingSettings,
} from '@/lib/jobs/costing';

export type CompanySettings = {
  id: number;
  company_id?: string | null;
  name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license_number: string | null;
  logo_url: string | null;
  brand_color: string | null;
  invoice_footer: string | null;
  estimate_footer: string | null;
  sms_signature: string | null;
  /** Google / review page URL for post paid+complete email ask */
  google_review_url: string | null;
  modules: Record<ModuleId, boolean>;
  role_permissions: RolePermissions;
  costing: CostingSettings;
};

export const COMPANY_FALLBACK: CompanySettings = {
  id: 0,
  company_id: null,
  name: 'My Company',
  legal_name: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  license_number: null,
  logo_url: null,
  brand_color: '#1a7af5',
  invoice_footer:
    'Thank you for your business. Payment is due upon receipt unless otherwise noted.',
  estimate_footer:
    'This estimate is valid for 30 days. Prices may change if site conditions differ.',
  sms_signature: 'My Company',
  google_review_url: null,
  modules: normalizeModules({}),
  role_permissions: normalizeRolePermissions({}),
  costing: { ...DEFAULT_COSTING },
};

function hydrate(row: Record<string, unknown> | null): CompanySettings {
  if (!row) return COMPANY_FALLBACK;
  const {
    modules: rawModules,
    role_permissions: rawPerms,
    costing: rawCosting,
    google_review_url: rawReview,
    ...rest
  } = row;
  return {
    ...COMPANY_FALLBACK,
    ...rest,
    google_review_url:
      typeof rawReview === 'string' && rawReview.trim()
        ? rawReview.trim()
        : null,
    modules: normalizeModules(rawModules),
    role_permissions: normalizeRolePermissions(rawPerms),
    costing: normalizeCosting(rawCosting),
  } as CompanySettings;
}

async function resolveCompanyId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();
    return (data?.company_id as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Ensure a company_settings row exists for this tenant (service role). */
export async function ensureCompanySettingsForCompany(
  companyId: string
): Promise<CompanySettings | null> {
  try {
    const admin = createServiceClient();
    const existing = await admin
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (existing.data) {
      return hydrate(existing.data as Record<string, unknown>);
    }

    const { data: company } = await admin
      .from('companies')
      .select('id, name, billing_email')
      .eq('id', companyId)
      .maybeSingle();

    const name = company?.name?.trim() || 'My Company';
    const { data: maxRow } = await admin
      .from('company_settings')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = Number(maxRow?.id || 0) + 1;

    const { data: created, error } = await admin
      .from('company_settings')
      .insert({
        id: nextId,
        company_id: companyId,
        name,
        email: company?.billing_email || null,
        sms_signature: name,
      } as never)
      .select('*')
      .maybeSingle();

    if (!error && created) {
      return hydrate(created as Record<string, unknown>);
    }

    // Unique race: another request inserted first
    const again = await admin
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (again.data) return hydrate(again.data as Record<string, unknown>);

    return {
      ...COMPANY_FALLBACK,
      company_id: companyId,
      name,
      sms_signature: name,
      email: company?.billing_email || null,
    };
  } catch {
    return null;
  }
}

export async function loadCompanySettings(): Promise<CompanySettings> {
  try {
    const supabase = await createClient();
    const companyId = await resolveCompanyId();

    if (companyId) {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (!error && data) return hydrate(data as Record<string, unknown>);

      // Never fall back to another tenant's branding (e.g. id=1 demo shop)
      const ensured = await ensureCompanySettingsForCompany(companyId);
      if (ensured) return ensured;

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .maybeSingle();
      return {
        ...COMPANY_FALLBACK,
        company_id: companyId,
        name: company?.name?.trim() || 'My Company',
        sms_signature: company?.name?.trim() || 'My Company',
      };
    }

    // No company on profile yet — generic fallback (not another shop's name)
    return COMPANY_FALLBACK;
  } catch {
    return COMPANY_FALLBACK;
  }
}

/** Portal / public pages via service role. */
export async function loadCompanySettingsAdmin(
  companyId?: string | null
): Promise<CompanySettings> {
  try {
    const admin = createServiceClient();
    if (companyId) {
      const ensured = await ensureCompanySettingsForCompany(companyId);
      if (ensured) return ensured;
    }
    return COMPANY_FALLBACK;
  } catch {
    return COMPANY_FALLBACK;
  }
}

export function companyAddressLine(c: CompanySettings) {
  const line2 = [c.city, c.state].filter(Boolean).join(', ');
  const withZip = [line2, c.zip].filter(Boolean).join(' ');
  return [c.address, withZip].filter(Boolean).join(' · ');
}

export function companyHasModule(
  company: { modules?: CompanyModules | Record<ModuleId, boolean> },
  id: ModuleId
) {
  return normalizeModules(company.modules)[id];
}

export type { CompanyModules, ModuleId, RolePermissions };
