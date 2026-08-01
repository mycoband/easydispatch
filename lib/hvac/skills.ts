/** Common HVAC tech skills / cert tags for dispatch matching. */
export const HVAC_SKILL_TAGS = [
  'Service',
  'Install',
  'Maintenance',
  'Commercial',
  'Residential',
  'EPA 608',
  'NATE',
  'Brazing',
  'Electrical',
  'Controls',
  'Heat pump',
  'Gas furnace',
  'Mini-split',
  'Rooftop / RTU',
  'Chiller',
  'Sheet metal',
  'Sales',
] as const;

export type HvacSkill = (typeof HVAC_SKILL_TAGS)[number];

export function normalizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
}

export function skillMatchScore(
  techSkills: string[] | null | undefined,
  required: string[] | null | undefined
) {
  const need = normalizeSkills(required);
  if (!need.length) return { score: 1, missing: [] as string[] };
  const have = new Set(
    normalizeSkills(techSkills).map((s) => s.toLowerCase())
  );
  const missing = need.filter((s) => !have.has(s.toLowerCase()));
  const hit = need.length - missing.length;
  return { score: hit / need.length, missing };
}
