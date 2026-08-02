/**
 * Per-company feature modules.
 * Each paying HVAC shop can enable/disable categories to match how they work.
 * Always-on core: customers, jobs, tech run sheet basics, settings.
 *
 * ModuleToggles, FAQ, and Help bot all read from this list — keep it complete.
 */

export type CompanyModuleDef = {
  id: string;
  label: string;
  description: string;
  /** Extra how-to for FAQ / Help (shown after description). */
  help: string;
  href: string | null;
  defaultEnabled: boolean;
  group:
    | 'Scheduling'
    | 'Sales & money'
    | 'Recurring'
    | 'Operations'
    | 'Customer experience'
    | 'Field / tech';
};

export const COMPANY_MODULES = [
  {
    id: 'day_sheet',
    label: 'Day sheet',
    description:
      'Daily tech load by tech, stop list, and morning huddle PDF (with PDF documents on)',
    help: 'Office → Day sheet. With PDF documents on: Print PDF. Techs: My jobs shows Next up + Today/Later/Done; Today’s run sheet PDF when PDF documents is on.',
    href: '/dashboard/day-sheet',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'dispatch',
    label: 'Dispatch board',
    description: 'Assign techs and watch En Route / On Site status',
    help: 'Office → Dispatch. Drag jobs onto tech columns or use Reassign. Unassigned open jobs also appear in Dashboard → Needs you. Pair with Live dispatch board for realtime status.',
    href: '/dashboard/dispatch',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'dispatch_realtime',
    label: 'Live dispatch board',
    description:
      'Realtime En Route / On Site updates without refreshing (needs jobs in Supabase Realtime)',
    help: 'Keep Dispatch open — Drive/Arrive from the tech app updates badges live. Run supabase/ops-polish.sql once. Status shows “● Live” when connected.',
    href: null,
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'skill_dispatch',
    label: 'Assign-tech AI',
    description:
      'Suggest who should take a job from skills + today’s load + last known location',
    help: 'Settings → Tech roster skills. On Dispatch, unassigned jobs show Assign AI. Run supabase/differentiation.sql for GPS columns. Techs update location on Drive/Arrive.',
    href: null,
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'capacity_warnings',
    label: 'Day capacity warnings',
    description:
      'Flag overbooked techs (>8h) and overlapping scheduled jobs on dispatch & day sheet',
    help: 'Amber columns when est hours exceed ~8h. Overlap badges when scheduled windows collide (uses scheduled end or est hours).',
    href: null,
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description:
      'Week/month view — drag to change day, click to edit start time & duration',
    help: 'Office → Calendar. Drag a job to another day; click to edit start time and duration hours.',
    href: '/dashboard/calendar',
    defaultEnabled: true,
    group: 'Scheduling',
  },
  {
    id: 'estimates',
    label: 'Estimates',
    description: 'Quotes, line items, estimated P&L, convert/apply to job',
    help: 'Office → Estimates, or New/Build estimate from a job. Apply approved lines to the job. Techs need Build estimates permission.',
    href: '/dashboard/estimates',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'gbb',
    label: 'Good / Better / Best',
    description:
      'Multi-option install packages — from Estimates → Good / Better / Best',
    help: 'Estimates → Good / Better / Best. Customers can choose an option via the portal when linked.',
    href: '/dashboard/estimates/gbb',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'pricebook',
    label: 'Pricebook',
    description: 'Flat-rate presets with sell price, your cost, and item type',
    help: 'Office → Pricebook. Add presets or Import. Costs feed job costing when that module is on.',
    href: '/dashboard/pricebook',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'invoices',
    label: 'Invoices & payments',
    description:
      'Send invoices, Stripe links, cash/check; branded PDF when PDF documents is on',
    help: 'Office → Invoices or job invoice panel. Unpaid sent invoices also surface on Dashboard → Needs you. Send email/SMS, mark cash/check, Stripe pay link. PDF button needs PDF documents on.',
    href: '/dashboard/invoices',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'export',
    label: 'Accounting export',
    description:
      'QuickBooks-friendly CSV — paid/unpaid, customers, job costing & tech P&L',
    help: 'Office → Export. Pick date range and export type (invoices, customers, job costing, tech P&L).',
    href: '/dashboard/export',
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'job_costing',
    label: 'Job costing & profit',
    description:
      'Job & estimate P&L, wages, margins, profit reports, weekly digest, costing CSV',
    help: 'Settings → Job costing (wages, margin, digest). Sold/Cost/Profit on each job; profit KPIs on Reports; Export costing CSV. Needs job-costing.sql once.',
    href: null,
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'print_pdfs',
    label: 'PDF documents',
    description:
      'Branded invoice PDF, AI Job Walkthrough PDF, day-sheet PDF, tech run-sheet PDF',
    help: 'PDF buttons on invoices, Day sheet, tech My jobs, and Job Walkthrough → Download PDF. Walkthrough PDF also needs AI Job Walkthrough on. Turn off to hide all PDF downloads.',
    href: null,
    defaultEnabled: true,
    group: 'Sales & money',
  },
  {
    id: 'agreements',
    label: 'Service agreements',
    description: 'PM plans, memberships, manual Create PM / bill',
    help: 'Office → Agreements. Create plans, set next due, Create PM or bill manually. Pair with PM job automation for nightly auto jobs.',
    href: '/dashboard/agreements',
    defaultEnabled: true,
    group: 'Recurring',
  },
  {
    id: 'pm_automation',
    label: 'PM job automation',
    description:
      'Nightly cron creates due maintenance jobs from active agreements',
    help: 'Off by default. Needs Service agreements on. Overnight job creates Scheduled Maintenance/PM when next due is today or earlier.',
    href: null,
    defaultEnabled: false,
    group: 'Recurring',
  },
  {
    id: 'inventory',
    label: 'Truck inventory',
    description:
      'Stock levels; deduct on jobs (adds costed parts line when costing is on)',
    help: 'Office → Inventory. Techs deduct truck stock on a job when permitted. Pair with Reorder / PO list for low stock.',
    href: '/dashboard/inventory',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'inventory_po',
    label: 'Reorder / PO list',
    description:
      'Low-stock reorder list, vendor, suggested qty, export PO CSV',
    help: 'On Inventory when Truck inventory is on. Set min qty, vendor, reorder qty. Copy PO list / Export CSV / Mark ordered. Needs workflow-depth.sql for vendor fields.',
    href: null,
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'part_orders',
    label: 'Special-order parts',
    description: 'Needed → ordered → received → installed on jobs',
    help: 'Office → Parts, or Parts panel on a job. Track special orders from needed through installed.',
    href: '/dashboard/parts',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'equipment_timeline',
    label: 'Equipment timeline',
    description:
      'Per-unit history, editable PM checklist, and per-item photos (also → Job photos on a visit)',
    help: 'Customer → Equipment timeline, or job → PM checklist after linking a unit. Edit items to add/remove checks. Add photo on each item — on a job those photos also appear under Job photos (tag PM). Needs workflow-depth.sql for pm_checklist.',
    href: null,
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'callbacks',
    label: 'Callbacks & warranty',
    description:
      'Flagged revisits, auto-detected return visits, one-click Schedule revisit',
    help: 'Office → Callbacks → Schedule revisit opens New job as Callback for that customer/site.',
    href: '/dashboard/callbacks',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'reports',
    label: 'Reports',
    description:
      'Revenue, AR, tech productivity; profit KPIs when job costing is on',
    help: 'Office → Reports. With AI tools: Ask Reports. With job costing: profit KPIs and lowest-margin jobs.',
    href: '/dashboard/reports',
    defaultEnabled: true,
    group: 'Operations',
  },
  {
    id: 'messaging',
    label: 'Customer messaging',
    description: 'OMW, reminders, confirm links, SMS log',
    help: 'On Dispatch cards and job message actions. Needs Twilio env vars for real SMS; otherwise messages may simulate/log.',
    href: null,
    defaultEnabled: true,
    group: 'Customer experience',
  },
  {
    id: 'review_ask',
    label: 'Review ask',
    description:
      'Email a Google/review link after a job is paid and completed (Resend — no SMS)',
    help: 'Settings → Company profile → Google / review URL. Sends once when Paid + Completed. Needs differentiation.sql + Resend.',
    href: null,
    defaultEnabled: true,
    group: 'Customer experience',
  },
  {
    id: 'portal',
    label: 'Customer portal',
    description:
      'Customer account link: job status, history, approve estimates, pay invoices; plus estimate/invoice tokens',
    help: 'Customer profile → Customer portal link. Needs workflow-depth.sql for purpose “customer”. Estimate/invoice token links still work separately.',
    href: null,
    defaultEnabled: true,
    group: 'Customer experience',
  },
  {
    id: 'tech_view_office',
    label: 'Technician view (office)',
    description:
      'Owners, dispatchers, and office staff can open the same tech app screens field techs use',
    help: 'Settings → Feature modules → Technician view (office). On: dashboard header shows Tech view checkbox; job pages show Open technician view. Opens /tech with Next up on My jobs and Arrive → Work → Wrap up tickets (assignee names stay visible). Blue banner → Exit to office. Off: hides those controls. Actions still use office permissions.',
    href: '/tech',
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'ai',
    label: 'AI tools',
    description:
      'Ticket fill, voice → notes, plate scan, filters, diagnostic, Walkthrough Generate, margin coach, Ask Reports, Help bot',
    help: 'Needs XAI_API_KEY. On New job, AI ticket fill is the fastest path (paste call notes → Fill → review → Create); schedule/assign live under More options. Also required for Job Walkthrough → Generate Report, diagnostic / margin coach, Help bot. Whisper Transcribe needs OPENAI_API_KEY. Pair with AI Job Walkthrough for the walkthrough panel.',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'ai_walkthrough',
    label: 'AI Job Walkthrough',
    description:
      'On-job video (camera+mic), voice, and photos → AI report you edit and save',
    help: 'Shows Job Walkthrough (AI) on tech and office jobs. On tech Work phase, Record video walkthrough is the hero CTA (“Film + narrate — AI writes the report”). Generate: frames so Grok can see + Whisper so Grok can hear (needs XAI_API_KEY, OPENAI_API_KEY, AI tools). Save copies diagnosis/summary + line items. PDF needs PDF documents. SQL: ai-walkthrough.sql + ai-walkthrough-video.sql if video kind fails.',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'tech_media',
    label: 'Job photos & voice',
    description:
      'Before/after photos and voice notes on the job (separate from Walkthrough video)',
    help: 'On the tech job Work phase → Extra photos (collapsed when Walkthrough is on) or Job photos if Walkthrough is off. Prefer Record walkthrough first when AI Job Walkthrough is enabled. Record voice → Transcribe → notes (AI tools + OPENAI_API_KEY).',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'tech_offline_queue',
    label: 'Offline notes & time',
    description:
      'Queue diagnosis notes and Drive/Arrive/Clock Out when signal drops; sync when back online',
    help: 'On tech job (Arrive / Wrap): banner shows Offline / Sync now. Queues Save notes and time buttons in the browser until online. After sync, Arrive still advances to Work and Clock out to Wrap up on the tech ticket.',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
  {
    id: 'tech_safety',
    label: 'Safety checklist',
    description: 'Lockout, ladder, refrigerant, permit checks',
    help: 'On the tech job → Work phase → Safety checklist. Techs need the Safety permission.',
    href: null,
    defaultEnabled: true,
    group: 'Field / tech',
  },
] as const satisfies readonly CompanyModuleDef[];

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

/** One-line catalog for Help bot / FAQ summary. */
export function moduleCatalogLines() {
  return COMPANY_MODULES.map(
    (m) =>
      `- ${m.label} (${m.group}${m.defaultEnabled ? '' : ', default off'}): ${m.description}`
  ).join('\n');
}
