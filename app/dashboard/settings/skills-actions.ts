'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { normalizeSkills } from '@/lib/hvac/skills';

export type ActionState = {
  error?: string;
  success?: string;
};

export async function saveTechSkills(
  profileId: string,
  skills: string[],
  certifications: string
): Promise<ActionState> {
  try {
    const { supabase } = await requireOffice();

    const cleanSkills = normalizeSkills(skills);
    const cleanCerts = certifications.trim();

    const { error } = await supabase
      .from('profiles')
      .update({
        skills: cleanSkills,
        certifications: cleanCerts || null,
      })
      .eq('id', profileId);

    if (error) return { error: error.message };

    revalidatePath('/dashboard/settings');
    return { success: 'Skills updated' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save skills',
    };
  }
}
