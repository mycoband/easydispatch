/** Standard HVAC PM checklist per equipment unit. */
export const EQUIPMENT_PM_ITEMS = [
  { id: 'filters', label: 'Filters inspected / replaced' },
  { id: 'coils', label: 'Coils cleaned / inspected' },
  { id: 'drain', label: 'Condensate drain clear' },
  { id: 'electrical', label: 'Electrical connections tight' },
  { id: 'capacitor', label: 'Capacitors / contactor checked' },
  { id: 'refrigerant', label: 'Refrigerant pressures / temps noted' },
  { id: 'blower', label: 'Blower / belt / motor OK' },
  { id: 'safety', label: 'Safety controls tested' },
  { id: 'thermostat', label: 'Thermostat operation verified' },
  { id: 'outdoor', label: 'Outdoor unit clear / level' },
] as const;

export type PmItemId = (typeof EQUIPMENT_PM_ITEMS)[number]['id'];

export type PmChecklistState = Partial<
  Record<PmItemId, { checked: boolean; at?: string | null }>
>;

export function normalizePmChecklist(raw: unknown): PmChecklistState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: PmChecklistState = {};
  for (const item of EQUIPMENT_PM_ITEMS) {
    const v = src[item.id];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const row = v as { checked?: unknown; at?: unknown };
      out[item.id] = {
        checked: Boolean(row.checked),
        at: typeof row.at === 'string' ? row.at : null,
      };
    }
  }
  return out;
}
