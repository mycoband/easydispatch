'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice, type AppRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/admin';
import { ensureOwnerRole } from '@/lib/tenant/ensure-owner';

export type TeamActionState = { error?: string; success?: string };

const ASSIGNABLE: AppRole[] = ['technician', 'dispatcher', 'office'];

export async function createTeamMember(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  try {
    const ctx = await requireOffice();
    const profile = await ensureOwnerRole(ctx.profile);

    if (profile.role !== 'owner' && profile.role !== 'dispatcher') {
      return { error: 'Only owners and dispatchers can add team members' };
    }
    if (!profile.company_id) {
      return {
        error:
          'No company linked. Sign out/in after running multi-tenant-saas.sql',
      };
    }

    const fullName = String(formData.get('full_name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const role = String(formData.get('role') || 'technician') as AppRole;

    if (!fullName) return { error: 'Name is required' };
    if (!email || !email.includes('@')) return { error: 'Valid email required' };
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters' };
    }
    if (!ASSIGNABLE.includes(role)) {
      return { error: 'Invalid role' };
    }

    const admin = createServiceClient();

    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', profile.company_id);

    const { data: company } = await admin
      .from('companies')
      .select('seat_limit')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (
      company?.seat_limit &&
      typeof count === 'number' &&
      count >= company.seat_limit
    ) {
      return {
        error: `Seat limit reached (${company.seat_limit}). Upgrade the plan or remove a user.`,
      };
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

    if (createError || !created.user) {
      const msg = createError?.message || 'Could not create user';
      if (msg.toLowerCase().includes('already')) {
        return {
          error:
            'That email already has an account. Have them sign in, or use Join with invite on a different email.',
        };
      }
      return { error: msg };
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: created.user.id,
        full_name: fullName,
        role,
        company_id: profile.company_id,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      return {
        error: `User created but profile failed: ${profileError.message}`,
      };
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/dispatch');
    revalidatePath('/dashboard/jobs');

    return {
      success: `${fullName} added as ${role}. They can sign in at /login with ${email}.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not add team member',
    };
  }
}
