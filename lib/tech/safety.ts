export const SAFETY_CHECKLIST_ITEMS = [
  { id: 'ppe', label: 'PPE on (gloves, glasses, boots)' },
  { id: 'lockout', label: 'Lockout / tagout completed' },
  { id: 'ladder', label: 'Ladder / roof access safe' },
  { id: 'electrical', label: 'Power verified safe before work' },
  { id: 'refrigerant', label: 'Refrigerant recovery / log noted if needed' },
  { id: 'permit', label: 'Permit / HOA / site rules checked' },
  { id: 'co', label: 'CO / combustion check if applicable' },
  { id: 'cleanup', label: 'Work area clean / hazards cleared' },
] as const;

export type SafetyItemId = (typeof SAFETY_CHECKLIST_ITEMS)[number]['id'];

export type SafetyChecklistState = Partial<
  Record<SafetyItemId, { checked: boolean; at?: string | null }>
>;
