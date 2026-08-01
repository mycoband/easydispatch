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

/** Infer preferred skills from job type text for dispatch suggestions. */
export function skillsForJobType(jobType: string | null | undefined): string[] {
  const t = (jobType || '').toLowerCase();
  const out = new Set<string>();
  if (!t) return [];
  if (/install|change.?out|replacement/.test(t)) out.add('Install');
  if (/maint|pm|tune|filter|agreement/.test(t)) out.add('Maintenance');
  if (/service|repair|no.?cool|no.?heat|callback|diagnos/.test(t)) {
    out.add('Service');
  }
  if (/commercial|rtu|rooftop/.test(t)) {
    out.add('Commercial');
    out.add('Rooftop / RTU');
  }
  if (/residential|home|house/.test(t)) out.add('Residential');
  if (/heat.?pump/.test(t)) out.add('Heat pump');
  if (/furnace|gas/.test(t)) out.add('Gas furnace');
  if (/mini.?split|ductless/.test(t)) out.add('Mini-split');
  if (/chiller/.test(t)) out.add('Chiller');
  if (/control|thermostat/.test(t)) out.add('Controls');
  if (/electric|electrical/.test(t)) out.add('Electrical');
  if (out.size === 0) out.add('Service');
  return [...out];
}
