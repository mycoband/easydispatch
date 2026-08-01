import { redirect } from 'next/navigation';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import {
  roleHasPermission,
  type PermissionId,
} from '@/lib/company/permissions';

/**
 * Assert the current user has a permission.
 * Returns profile context on success; throws/redirects on failure.
 */
export async function requirePermission(permission: PermissionId) {
  const ctx = await requireProfile();
  const company = await loadCompanySettings();

  if (
    !roleHasPermission(
      ctx.profile.role,
      permission,
      company.role_permissions
    )
  ) {
    if (isOfficeRole(ctx.profile.role)) {
      redirect('/dashboard?denied=1');
    }
    throw new Error('You do not have permission for this action');
  }

  return { ...ctx, company };
}

export async function assertPermission(
  permission: PermissionId
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireProfile();
    const company = await loadCompanySettings();
    if (
      !roleHasPermission(
        ctx.profile.role,
        permission,
        company.role_permissions
      )
    ) {
      return {
        ok: false,
        error: 'Your role is not allowed to do this. Ask an owner or dispatcher.',
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Permission check failed',
    };
  }
}

export function can(
  role: Parameters<typeof roleHasPermission>[0],
  permission: PermissionId,
  permissions: Parameters<typeof roleHasPermission>[2]
) {
  return roleHasPermission(role, permission, permissions);
}

/**
 * For shared actions (invoice, SMS, time): office roles pass;
 * technicians must have the named tech permission.
 */
export async function assertTechCapability(permission: PermissionId) {
  const ctx = await requireProfile();
  if (isOfficeRole(ctx.profile.role)) return { ok: true as const };
  return assertPermission(permission);
}
