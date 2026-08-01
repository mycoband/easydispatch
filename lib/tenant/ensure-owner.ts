import { createServiceClient } from '@/lib/supabase/admin';
import type { Profile } from '@/lib/auth';

/**
 * If this user owns the company (or is the only office user on it) but
 * their profile role is still dispatcher/office, promote to owner so
 * Billing / invite UI is available.
 */
export async function ensureOwnerRole(profile: Profile): Promise<Profile> {
  if (profile.role === 'owner' || !profile.company_id) return profile;

  try {
    const admin = createServiceClient();
    const { data: company } = await admin
      .from('companies')
      .select('id, owner_user_id')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (!company) return profile;

    const isListedOwner = company.owner_user_id === profile.id;
    let shouldPromote = isListedOwner;

    if (!shouldPromote && !company.owner_user_id) {
      // Legacy default company with no owner set — claim if first office user
      const { count } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .in('role', ['owner', 'dispatcher', 'office']);
      if ((count ?? 0) <= 1) {
        shouldPromote = true;
        await admin
          .from('companies')
          .update({ owner_user_id: profile.id, updated_at: new Date().toISOString() })
          .eq('id', company.id);
      }
    }

    if (!shouldPromote) return profile;

    await admin
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', profile.id);

    return { ...profile, role: 'owner' };
  } catch {
    return profile;
  }
}
