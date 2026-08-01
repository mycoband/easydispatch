import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import type { ModuleId } from '@/lib/company/modules';
import {
  roleHasPermission,
  type PermissionId,
} from '@/lib/company/permissions';

/** Call at the top of a dashboard page that belongs to a toggleable module. */
export async function requireCompanyModule(id: ModuleId) {
  const company = await loadCompanySettings();
  if (!company.modules[id]) {
    redirect(`/dashboard?moduleDisabled=${id}`);
  }
  return company;
}

/** Module gate + office role permission (e.g. reports, pricebook). */
export async function requireCompanyModuleAndPermission(
  moduleId: ModuleId,
  permission: PermissionId
) {
  const company = await requireCompanyModule(moduleId);
  const { profile } = await requireProfile();
  if (!roleHasPermission(profile.role, permission, company.role_permissions)) {
    redirect('/dashboard?denied=1');
  }
  return company;
}
