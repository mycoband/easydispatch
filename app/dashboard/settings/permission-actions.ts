'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import {
  normalizeRolePermissions,
  roleHasPermission,
  type RolePermissions,
} from '@/lib/company/permissions';

export type ActionState = { error?: string; success?: string };

export async function saveRolePermissions(
  input: RolePermissions
): Promise<ActionState> {
  try {
    const { supabase, profile } = await requireOffice();
    const company = await loadCompanySettings();

    if (
      !roleHasPermission(
        profile.role,
        'manage_permissions',
        company.role_permissions
      )
    ) {
      return { error: 'You are not allowed to change role permissions' };
    }

    const normalized = normalizeRolePermissions(input);

    let error;
    if (profile.company_id) {
      const existing = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', profile.company_id)
        .maybeSingle();
      if (existing.data?.id) {
        ({ error } = await supabase
          .from('company_settings')
          .update({
            role_permissions: normalized,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.data.id));
      } else {
        ({ error } = await supabase.from('company_settings').upsert(
          {
            id: 1,
            company_id: profile.company_id,
            role_permissions: normalized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ));
      }
    } else {
      ({ error } = await supabase.from('company_settings').upsert(
        {
          id: 1,
          role_permissions: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      ));
    }

    if (error) {
      return {
        error:
          error.message.includes('role_permissions') || error.code === 'PGRST204'
            ? 'Could not save permissions. Refresh, check Settings, or contact support.'
            : error.message,
      };
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');
    revalidatePath('/tech');
    return { success: 'Role permissions saved' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save permissions',
    };
  }
}
