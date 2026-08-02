'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { TECH_VIEW_COOKIE } from '@/lib/tech/tech-view';

async function assertOfficeTechViewAllowed() {
  const { profile } = await requireProfile();
  if (!isOfficeRole(profile.role)) {
    throw new Error('Only office roles can toggle Technician view');
  }
  const company = await loadCompanySettings();
  if (!company.modules.tech_view_office) {
    throw new Error(
      'Technician view is off. Turn it on in Settings → Feature modules.'
    );
  }
  return profile;
}

/** Enter the tech app UI (same screens technicians use). */
export async function enableTechnicianView(jobId?: string) {
  await assertOfficeTechViewAllowed();
  const jar = await cookies();
  jar.set(TECH_VIEW_COOKIE, '1', {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (jobId) {
    redirect(`/tech/jobs/${jobId}`);
  }
  redirect('/tech');
}

/** Leave tech preview and return to the office dashboard. */
export async function disableTechnicianView() {
  const { profile } = await requireProfile();
  if (!isOfficeRole(profile.role)) {
    throw new Error('Only office roles can toggle Technician view');
  }
  const jar = await cookies();
  jar.delete(TECH_VIEW_COOKIE);
  redirect('/dashboard');
}
