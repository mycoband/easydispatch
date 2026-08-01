import type { AppRole } from '@/lib/roles';

/**
 * Configurable capabilities. Owner always has full access.
 * Defaults match today’s product behavior (techs get a full run sheet).
 */

export const TECH_PERMISSIONS = [
  {
    id: 'time_track',
    label: 'Time tracking',
    description: 'Drive start, arrive, and clock out',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'edit_notes',
    label: 'Edit diagnosis & notes',
    description: 'Diagnosis, customer summary, internal notes',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'manage_equipment',
    label: 'Manage equipment',
    description: 'Add/edit units, plate scan, link to job',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'media',
    label: 'Photos & voice notes',
    description: 'Upload job media and customer verbal approval',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'safety',
    label: 'Safety checklist',
    description: 'Lockout, ladder, refrigerant checks',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'ai_diagnostic',
    label: 'AI diagnostic assist',
    description: 'Grok-powered troubleshooting help',
    group: 'On the job',
    defaultEnabled: true,
  },
  {
    id: 'part_orders',
    label: 'Special-order parts',
    description: 'Add and advance part orders on jobs',
    group: 'Parts & stock',
    defaultEnabled: true,
  },
  {
    id: 'inventory_deduct',
    label: 'Deduct truck stock',
    description: 'Pull parts from inventory on a job',
    group: 'Parts & stock',
    defaultEnabled: true,
  },
  {
    id: 'messaging',
    label: 'Customer texts',
    description: 'On my way, reminder, and confirm links',
    group: 'Money & customer',
    defaultEnabled: true,
  },
  {
    id: 'customer_signature',
    label: 'Collect signature',
    description: 'Customer sign-off and mark job completed',
    group: 'Money & customer',
    defaultEnabled: true,
  },
  {
    id: 'send_invoice',
    label: 'Send invoice',
    description: 'Email/SMS invoice with pay link from the truck',
    group: 'Money & customer',
    defaultEnabled: true,
  },
  {
    id: 'record_payment',
    label: 'Record cash / check',
    description: 'Mark paid when customer pays on site',
    group: 'Money & customer',
    defaultEnabled: true,
  },
  {
    id: 'edit_line_items',
    label: 'Edit line items / pricing',
    description: 'Change prices on the job (off by default — office usually prices)',
    group: 'Money & customer',
    defaultEnabled: false,
  },
  {
    id: 'manage_estimates',
    label: 'Build estimates on jobs',
    description: 'Create and edit estimates linked to assigned jobs',
    group: 'Money & customer',
    defaultEnabled: true,
  },
] as const;

export const OFFICE_PERMISSIONS = [
  {
    id: 'manage_settings',
    label: 'Company settings',
    description: 'Edit company profile and branding',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'manage_modules',
    label: 'Feature modules',
    description: 'Turn whole product categories on/off',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'manage_permissions',
    label: 'Role permissions',
    description: 'Change what techs and staff can do',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'view_reports',
    label: 'Reports & export',
    description: 'Revenue, AR, and accounting CSV',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'view_job_costs',
    label: 'View job costs & profit',
    description: 'See cost, margin, and P&L on jobs and reports',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'edit_job_costs',
    label: 'Edit job costs',
    description: 'Change unit costs on line items and pricebook',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'manage_pricebook',
    label: 'Pricebook',
    description: 'Add, edit, import, and delete rates',
    group: 'Office access',
    defaultEnabled: true,
  },
  {
    id: 'delete_customers',
    label: 'Delete customers',
    description: 'Permanently remove customer records',
    group: 'Office access',
    defaultEnabled: true,
  },
] as const;

export type TechPermissionId = (typeof TECH_PERMISSIONS)[number]['id'];
export type OfficePermissionId = (typeof OFFICE_PERMISSIONS)[number]['id'];
export type PermissionId = TechPermissionId | OfficePermissionId;

export type RolePermissionMap = {
  technician: Record<TechPermissionId, boolean>;
  dispatcher: Record<OfficePermissionId, boolean>;
  office: Record<OfficePermissionId, boolean>;
};

export type RolePermissions = RolePermissionMap;

function defaultsForTech(): Record<TechPermissionId, boolean> {
  return Object.fromEntries(
    TECH_PERMISSIONS.map((p) => [p.id, p.defaultEnabled])
  ) as Record<TechPermissionId, boolean>;
}

function defaultsForOffice(): Record<OfficePermissionId, boolean> {
  return Object.fromEntries(
    OFFICE_PERMISSIONS.map((p) => [p.id, p.defaultEnabled])
  ) as Record<OfficePermissionId, boolean>;
}

export function defaultRolePermissions(): RolePermissions {
  return {
    technician: defaultsForTech(),
    dispatcher: defaultsForOffice(),
    office: {
      ...defaultsForOffice(),
      // Leaner default for pure office clerks
      manage_modules: false,
      manage_permissions: false,
    },
  };
}

function mergeBoolMap<T extends string>(
  defaults: Record<T, boolean>,
  raw: unknown
): Record<T, boolean> {
  const out = { ...defaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults) as T[]) {
    if (typeof src[key] === 'boolean') out[key] = src[key] as boolean;
  }
  return out;
}

export function normalizeRolePermissions(raw: unknown): RolePermissions {
  const defaults = defaultRolePermissions();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const src = raw as Record<string, unknown>;
  return {
    technician: mergeBoolMap(defaults.technician, src.technician),
    dispatcher: mergeBoolMap(defaults.dispatcher, src.dispatcher),
    office: mergeBoolMap(defaults.office, src.office),
  };
}

/** Owner always allowed. Technicians use tech map; office roles use office map. */
export function roleHasPermission(
  role: AppRole,
  permission: PermissionId,
  permissions: RolePermissions | null | undefined
): boolean {
  if (role === 'owner') return true;
  const normalized = normalizeRolePermissions(permissions);

  if (role === 'technician') {
    if (!(permission in normalized.technician)) return false;
    return normalized.technician[permission as TechPermissionId];
  }

  if (role === 'dispatcher' || role === 'office') {
    if (!(permission in normalized[role])) return false;
    return normalized[role][permission as OfficePermissionId];
  }

  return false;
}

export const TECH_PERMISSION_GROUPS = [
  'On the job',
  'Parts & stock',
  'Money & customer',
] as const;

export const OFFICE_PERMISSION_GROUPS = ['Office access'] as const;

/** Presets for the technician column. */
export function techPreset(
  kind: 'full' | 'field_only' | 'minimal'
): Record<TechPermissionId, boolean> {
  const all = defaultsForTech();
  if (kind === 'full') {
    return { ...all, edit_line_items: true };
  }
  if (kind === 'minimal') {
    const next = { ...all };
    for (const k of Object.keys(next) as TechPermissionId[]) next[k] = false;
    next.time_track = true;
    next.edit_notes = true;
    next.customer_signature = true;
    return next;
  }
  // field_only — run the job, no money
  return {
    ...all,
    send_invoice: false,
    record_payment: false,
    edit_line_items: false,
    manage_estimates: false,
  };
}
