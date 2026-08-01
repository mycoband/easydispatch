/**
 * Per-company feature modules.
 * Each paying HVAC shop can enable/disable categories to match how they work.
 * Always-on core: customers, jobs, tech run sheet basics, settings.
 */

export const COMPANY_MODULES = [
  {
    id: 'day_sheet',
    label: 'Day sheet',
    description: 'Daily tech load and stop list',
    href: '/dashboard/day-sheet',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'dispatch',
    label: 'Dispatch board',
    description: 'Assign techs and watch live status',
    href: '/dashboard/dispatch',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Week view and jump-to-date scheduling',
    href: '/dashboard/calendar',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'estimates',
    label: 'Estimates',
    description: 'Quotes, line items, convert to job',
    href: '/dashboard/estimates',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'gbb',
    label: 'Good / Better / Best',
    description: 'Multi-option install packages for customers',
    href: '/dashboard/estimates/gbb',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'pricebook',
    label: 'Pricebook',
    description: 'Flat-rate parts and labor presets',
    href: '/dashboard/pricebook',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'invoices',
    label: 'Invoices & payments',
    description: 'Send invoices, Stripe links, cash/check',
    href: '/dashboard/invoices',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'export',
    label: 'Accounting export',
    description: 'QuickBooks-friendly CSV downloads',
    href: '/dashboard/export',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'agreements',
    label: 'Service agreements',
    description: 'PM plans, memberships, renewals',
    href: '/dashboard/agreements',
    defaultEnabled: true,
    group: 'Recurring',
  },
  {
    id: 'inventory',
    label: 'Truck inventory',
    description: 'Stock levels and deduct from jobs',
    href: '/dashboard/inventory',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'part_orders',
    label: 'Special-order parts',
    description: 'Needed → ordered → received → installed on jobs',
    href: '/dashboard/parts',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'callbacks',
    label: 'Callbacks & warranty',
    description: 'Flagged revisits and warranty jobs',
    href: '/dashboard/callbacks',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Revenue, AR, tech load snapshot',
    href: '/dashboard/reports',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'job_costing',
    label: 'Job costing & profit',
    description:
      'Job P&L, material/labor costs, margins, profit reports, AI margin coach',
    href: null,
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'messaging',
    label: 'Customer messaging',
    description: 'OMW, reminders, confirm links, SMS log',
    href: null,
    defaultEnabled: true,
    group: 'Customer experience',
  },
  {
    id: 'portal',
    label: 'Customer portal',
    description: 'Token links for estimates and invoices',
    href: null,
    defaultEnabled: true,
    group: 'Customer experience',
  },
  {
    id: 'ai',
    label: 'AI tools',
    description: 'Ticket fill, plate scan, filter lookup, diagnostic assist',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'tech_media',
    label: 'Job photos & voice',
    description: 'Before/after photos and voice notes on jobs',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'tech_safety',
    label: 'Safety checklist',
    description: 'Lockout, ladder, refrigerant, permit checks',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
] as const;

export type ModuleId = (typeof COMPANY_MODULES)[number]['id'];

export type CompanyModules = Partial<Record<ModuleId, boolean>>;

export const DEFAULT_MODULES: Record<ModuleId, boolean> = Object.fromEntries(
  COMPANY_MODULES.map((m) => [m.id, m.defaultEnabled])
) as Record<ModuleId, boolean>;

/** Merge stored JSON with defaults (unknown keys ignored; missing → default). */
export function normalizeModules(raw: unknown): Record<ModuleId, boolean> {
  const stored =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = { ...DEFAULT_MODULES };
  for (const mod of COMPANY_MODULES) {
    if (typeof stored[mod.id] === 'boolean') {
      out[mod.id] = stored[mod.id] as boolean;
    }
  }
  return out;
}

export function isModuleEnabled(
  modules: CompanyModules | Record<ModuleId, boolean> | null | undefined,
  id: ModuleId
) {
  const normalized = normalizeModules(modules);
  return Boolean(normalized[id]);
}

/** Map a dashboard path to the module that gates it (if any). */
export function moduleForPath(pathname: string): ModuleId | null {
  const exact = COMPANY_MODULES.find((m) => m.href && pathname === m.href);
  if (exact) return exact.id;

  // Nested routes under a module home
  const prefixes: { prefix: string; id: ModuleId }[] = [
    { prefix: '/dashboard/day-sheet', id: 'day_sheet' },
    { prefix: '/dashboard/dispatch', id: 'dispatch' },
    { prefix: '/dashboard/calendar', id: 'calendar' },
    { prefix: '/dashboard/estimates/gbb', id: 'gbb' },
    { prefix: '/dashboard/estimates', id: 'estimates' },
    { prefix: '/dashboard/pricebook', id: 'pricebook' },
    { prefix: '/dashboard/invoices', id: 'invoices' },
    { prefix: '/dashboard/export', id: 'export' },
    { prefix: '/dashboard/agreements', id: 'agreements' },
    { prefix: '/dashboard/inventory', id: 'inventory' },
    { prefix: '/dashboard/parts', id: 'part_orders' },
    { prefix: '/dashboard/callbacks', id: 'callbacks' },
    { prefix: '/dashboard/reports', id: 'reports' },
  ];

  for (const row of prefixes) {
    if (
      pathname === row.prefix ||
      pathname.startsWith(`${row.prefix}/`)
    ) {
      return row.id;
    }
  }
  return null;
}

export function navItemsForModules(
  items: { href: string; label: string }[],
  modules: CompanyModules | Record<ModuleId, boolean>
) {
  const normalized = normalizeModules(modules);
  return items.filter((item) => {
    const mod = moduleForPath(item.href);
    if (!mod) return true;
    return normalized[mod];
  });
}

export const MODULE_GROUPS = [
  'Scheduling',
  'Sales & money',
  'Recurring',
  'Operations',
  'Customer experience',
  'Field / tech',
] as const;
