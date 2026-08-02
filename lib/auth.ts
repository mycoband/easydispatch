import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import {
  homeForRole,
  isOfficeRole,
  type AppRole,
} from '@/lib/roles';
import type { User } from '@supabase/supabase-js';
import {
  companyAccessBlocked,
  joinCompanyByInvite,
  loadCompanyById,
  provisionCompanyForUser,
  type CompanyRecord,
} from '@/lib/tenant';
import {
  isTechViewCookie,
  TECH_VIEW_COOKIE,
} from '@/lib/tech/tech-view';

export type { AppRole };
export { homeForRole, isOfficeRole };

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  phone: string | null;
  avatar_url: string | null;
  company_id: string | null;
};

const VALID_ROLES: AppRole[] = ['owner', 'dispatcher', 'technician', 'office'];

function normalizeRole(value: unknown): AppRole {
  if (typeof value === 'string' && VALID_ROLES.includes(value as AppRole)) {
    return value as AppRole;
  }
  return 'dispatcher';
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

async function attachCompanyIfNeeded(
  user: User,
  profile: Profile
): Promise<Profile> {
  const meta = user.user_metadata ?? {};
  const admin = createServiceClient();

  const wantsOwnCompany =
    meta.create_company === true ||
    meta.create_company === 'true' ||
    (normalizeRole(meta.role) === 'owner' &&
      typeof meta.company_name === 'string' &&
      Boolean(meta.company_name.trim()));

  // Repair: owner signup was wrongly glued to another shop (e.g. DC Refrigeration)
  if (profile.company_id && wantsOwnCompany) {
    const { data: current } = await admin
      .from('companies')
      .select('id, owner_user_id, name')
      .eq('id', profile.company_id)
      .maybeSingle();
    const ownsIt = current?.owner_user_id === user.id;
    if (ownsIt) return profile;

    const companyName =
      (typeof meta.company_name === 'string' && meta.company_name.trim()) ||
      `${profile.full_name || 'My'} HVAC`;
    const { company, error } = await provisionCompanyForUser({
      userId: user.id,
      companyName,
      billingEmail: user.email,
      fullName: profile.full_name,
    });
    if (!error && company?.id) {
      return { ...profile, company_id: company.id, role: 'owner' };
    }
    return profile;
  }

  if (profile.company_id) return profile;

  // Join via invite
  const invite =
    typeof meta.invite_code === 'string' ? meta.invite_code.trim() : '';
  if (invite) {
    const joined = await joinCompanyByInvite({
      userId: user.id,
      inviteCode: invite,
      fullName: profile.full_name,
      role: normalizeRole(meta.role),
    });
    if (joined.companyId) {
      return {
        ...profile,
        company_id: joined.companyId,
        role: normalizeRole(meta.role),
      };
    }
  }

  // Create new shop when signing up as owner (or create_company flag)
  if (wantsOwnCompany || normalizeRole(meta.role) === 'owner') {
    const companyName =
      (typeof meta.company_name === 'string' && meta.company_name.trim()) ||
      `${profile.full_name || 'My'} HVAC`;
    const { company, error } = await provisionCompanyForUser({
      userId: user.id,
      companyName,
      billingEmail: user.email,
      fullName: profile.full_name,
    });
    if (!error && company?.id) {
      return { ...profile, company_id: company.id, role: 'owner' };
    }
  }

  // Do NOT attach strangers to the oldest company (that leaked DC Refrigeration
  // branding onto every new signup).
  return profile;
}

/** Create/repair profile row if the signup trigger missed it. */
async function loadProfileRow(userId: string): Promise<Profile | null> {
  const admin = createServiceClient();
  const withCompany = await admin
    .from('profiles')
    .select('id, full_name, role, phone, avatar_url, company_id')
    .eq('id', userId)
    .maybeSingle();

  if (!withCompany.error && withCompany.data) {
    return {
      ...(withCompany.data as Profile),
      company_id: (withCompany.data as Profile).company_id ?? null,
    };
  }

  // Pre-migration: company_id column missing
  const legacy = await admin
    .from('profiles')
    .select('id, full_name, role, phone, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (legacy.data) {
    return { ...(legacy.data as Omit<Profile, 'company_id'>), company_id: null };
  }
  return null;
}

export async function ensureProfile(user: User): Promise<Profile> {
  const admin = createServiceClient();
  const existing = await loadProfileRow(user.id);
  if (existing) return attachCompanyIfNeeded(user, existing);

  const meta = user.user_metadata ?? {};
  const payload = {
    id: user.id,
    full_name:
      (typeof meta.full_name === 'string' && meta.full_name) ||
      user.email?.split('@')[0] ||
      'User',
    role: normalizeRole(meta.role),
  };

  const { error } = await admin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message || 'Could not create profile');
  }

  const created = await loadProfileRow(user.id);
  if (!created) throw new Error('Could not create profile');
  return attachCompanyIfNeeded(user, created);
}

export async function getProfile(): Promise<Profile | null> {
  const { user } = await getSessionUser();
  if (!user) return null;

  try {
    return await ensureProfile(user);
  } catch {
    return null;
  }
}

export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const profile = await ensureProfile(user);
  return { supabase, user, profile };
}

export async function requireOffice() {
  const ctx = await requireProfile();
  if (!isOfficeRole(ctx.profile.role)) {
    redirect('/tech');
  }
  return ctx;
}

export async function requireTech() {
  const ctx = await requireProfile();
  if (isOfficeRole(ctx.profile.role)) {
    redirect('/dashboard');
  }
  return ctx;
}

/**
 * Access the technician app UI.
 * Real technicians always; office/owner/dispatcher only with Technician view cookie.
 */
export async function requireTechApp() {
  const ctx = await requireProfile();
  if (ctx.profile.role === 'technician') {
    return { ...ctx, techViewPreview: false as const };
  }
  if (isOfficeRole(ctx.profile.role)) {
    const jar = await cookies();
    if (isTechViewCookie(jar.get(TECH_VIEW_COOKIE)?.value)) {
      return { ...ctx, techViewPreview: true as const };
    }
    redirect('/dashboard');
  }
  redirect('/dashboard');
}

export async function isOfficeTechViewEnabled() {
  const jar = await cookies();
  return isTechViewCookie(jar.get(TECH_VIEW_COOKIE)?.value);
}

export async function requireCompany(): Promise<{
  supabase: Awaited<ReturnType<typeof requireProfile>>['supabase'];
  user: User;
  profile: Profile;
  company: CompanyRecord | null;
}> {
  const ctx = await requireProfile();
  let company: CompanyRecord | null = null;
  if (ctx.profile.company_id) {
    try {
      company = await loadCompanyById(ctx.profile.company_id);
    } catch {
      company = null;
    }
  }
  return { ...ctx, company };
}

/** Block app use when trial expired / subscription canceled (owners go to billing). */
export async function enforceBillingAccess() {
  const { profile, company } = await requireCompany();
  if (!companyAccessBlocked(company)) return { profile, company };

  if (isOfficeRole(profile.role) && profile.role === 'owner') {
    redirect('/dashboard/settings/billing?locked=1');
  }
  redirect('/billing-locked');
}
