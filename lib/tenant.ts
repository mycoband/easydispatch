import { createServiceClient } from '@/lib/supabase/admin';
import { subscriptionAllowsAccess } from '@/lib/billing/plans';

export type CompanyRecord = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_email: string | null;
  seat_limit: number | null;
  invite_code: string | null;
  owner_user_id: string | null;
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'shop'
  );
}

/** Create a company + attach user as owner. Uses service role. */
export async function provisionCompanyForUser(opts: {
  userId: string;
  companyName: string;
  billingEmail?: string | null;
  fullName?: string | null;
}): Promise<{ company: CompanyRecord; error?: string }> {
  const admin = createServiceClient();
  const baseSlug = slugify(opts.companyName);
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const invite = Math.random().toString(36).slice(2, 10).toUpperCase();

  const { data: company, error } = await admin
    .from('companies')
    .insert({
      name: opts.companyName.trim() || 'My HVAC Company',
      slug,
      owner_user_id: opts.userId,
      plan: 'trial',
      subscription_status: 'trialing',
      trial_ends_at: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toISOString(),
      billing_email: opts.billingEmail || null,
      invite_code: invite,
      seat_limit: 10,
    })
    .select('*')
    .single();

  if (error || !company) {
    return {
      company: null as unknown as CompanyRecord,
      error: error?.message || 'Could not create company',
    };
  }

  await admin
    .from('profiles')
    .update({
      company_id: company.id,
      role: 'owner',
      full_name: opts.fullName || undefined,
    })
    .eq('id', opts.userId);

  // Branding row for this tenant only (never reuse another shop's settings)
  try {
    const { data: existingSettings } = await admin
      .from('company_settings')
      .select('id')
      .eq('company_id', company.id)
      .maybeSingle();
    if (!existingSettings) {
      const { data: maxRow } = await admin
        .from('company_settings')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextId = Number(maxRow?.id || 0) + 1;
      const { error: settingsError } = await admin
        .from('company_settings')
        .insert({
          id: nextId,
          company_id: company.id,
          name: company.name,
          email: opts.billingEmail || null,
          sms_signature: company.name,
        } as never);
      if (settingsError) {
        console.error('company_settings insert failed:', settingsError.message);
      }
    }
  } catch (err) {
    console.error('company_settings provision error:', err);
  }

  return { company: company as CompanyRecord };
}

export async function joinCompanyByInvite(opts: {
  userId: string;
  inviteCode: string;
  fullName?: string | null;
  role?: string;
}): Promise<{ companyId?: string; error?: string }> {
  const admin = createServiceClient();
  const code = opts.inviteCode.trim().toUpperCase();
  if (!code) return { error: 'Invite code required' };

  const { data: company } = await admin
    .from('companies')
    .select('id, seat_limit')
    .eq('invite_code', code)
    .maybeSingle();

  if (!company) return { error: 'Invalid invite code' };

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id);

  if (
    company.seat_limit &&
    typeof count === 'number' &&
    count >= company.seat_limit
  ) {
    return { error: 'This company is at its seat limit' };
  }

  const role =
    opts.role === 'technician' ||
    opts.role === 'dispatcher' ||
    opts.role === 'office'
      ? opts.role
      : 'technician';

  const { error } = await admin
    .from('profiles')
    .update({
      company_id: company.id,
      role,
      full_name: opts.fullName || undefined,
    })
    .eq('id', opts.userId);

  if (error) return { error: error.message };
  return { companyId: company.id };
}

export async function loadCompanyById(
  companyId: string
): Promise<CompanyRecord | null> {
  const admin = createServiceClient();
  const { data } = await admin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();
  return (data as CompanyRecord | null) ?? null;
}

export function companyAccessBlocked(company: CompanyRecord | null) {
  if (!company) return false; // pre-migration / demo without companies table
  if (!subscriptionAllowsAccess(company.subscription_status)) return true;
  if (
    company.subscription_status === 'trialing' &&
    company.trial_ends_at &&
    new Date(company.trial_ends_at).getTime() < Date.now() &&
    !company.stripe_subscription_id
  ) {
    return true;
  }
  return false;
}
