import {
  COMPANY_MODULES,
  type ModuleId,
} from '@/lib/company/modules';

export type ShopPresetId = 'simple' | 'full_field' | 'full_shop';

export type ShopPresetDef = {
  id: ShopPresetId;
  label: string;
  description: string;
};

/** Named shop presets for Settings → Feature modules. */
export const SHOP_PRESETS: readonly ShopPresetDef[] = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Lean service shop — dispatch, calendar, invoices, AI field',
  },
  {
    id: 'full_field',
    label: 'Full field',
    description: 'Simple plus day sheet, safety, equipment, callbacks, portal',
  },
  {
    id: 'full_shop',
    label: 'Full shop',
    description: 'Everything on — full office + field',
  },
] as const;

const SIMPLE_IDS: readonly ModuleId[] = [
  'dispatch',
  'dispatch_realtime',
  'calendar',
  'invoices',
  'messaging',
  'tech_media',
  'tech_offline_queue',
  'ai',
  'ai_walkthrough',
  'print_pdfs',
  'tech_view_office',
];

const FULL_FIELD_EXTRA: readonly ModuleId[] = [
  'day_sheet',
  'skill_dispatch',
  'capacity_warnings',
  'tech_safety',
  'equipment_timeline',
  'callbacks',
  'review_ask',
  'portal',
];

/** Build a full module map for a named shop preset. */
export function modulesForPreset(
  id: ShopPresetId
): Record<ModuleId, boolean> {
  const next = {} as Record<ModuleId, boolean>;
  for (const m of COMPANY_MODULES) next[m.id] = false;

  if (id === 'full_shop') {
    for (const m of COMPANY_MODULES) next[m.id] = true;
    return next;
  }

  for (const mid of SIMPLE_IDS) next[mid] = true;

  if (id === 'full_field') {
    for (const mid of FULL_FIELD_EXTRA) next[mid] = true;
  }

  return next;
}
