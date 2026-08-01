'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import {
  COMPANY_MODULES,
  normalizeModules,
  type ModuleId,
} from '@/lib/company/modules';

export type ActionState = { error?: string; success?: string };

export async function saveCompanyModules(
  modules: Partial<Record<ModuleId, boolean>>
): Promise<ActionState> {
  try {
    const { supabase, profile } = await requireOffice();
    const normalized = normalizeModules(modules);

    const payload: Record<string, boolean> = {};
    for (const mod of COMPANY_MODULES) {
      payload[mod.id] = Boolean(normalized[mod.id]);
    }

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
            modules: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.data.id));
      } else {
        ({ error } = await supabase.from('company_settings').upsert(
          {
            id: 1,
            company_id: profile.company_id,
            modules: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ));
      }
    } else {
      ({ error } = await supabase.from('company_settings').upsert(
        {
          id: 1,
          modules: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      ));
    }

    if (error) {
      return {
        error:
          error.message.includes('modules') || error.code === 'PGRST204'
            ? `${error.message} — run supabase/company-modules.sql in the SQL editor.`
            : error.message,
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/tech');
    for (const mod of COMPANY_MODULES) {
      if (mod.href) revalidatePath(mod.href);
    }

    return { success: 'Feature modules updated for this company' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save modules',
    };
  }
}
