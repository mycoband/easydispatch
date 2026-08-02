'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { TECH_VIEW_COOKIE } from '@/lib/tech/tech-view';

async function assertOffice() {
  const { profile } = await requireProfile();
  if (!isOfficeRole(profile.role)) {
    throw new Error('Only office roles can toggle Technician view');
  }
  return profile;
}

/** Enter the tech app UI (same screens technicians use). */
export async function enableTechnicianView(jobId?: string) {
  await assertOffice();
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
  await assertOffice();
  const jar = await cookies();
  jar.delete(TECH_VIEW_COOKIE);
  redirect('/dashboard');
}
