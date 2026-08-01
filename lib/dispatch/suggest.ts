import { skillMatchScore, skillsForJobType } from '@/lib/hvac/skills';
import {
  formatMiles,
  haversineMiles,
  proximityScore,
  type LatLng,
  isValidLatLng,
} from '@/lib/geo/distance';
import { DEFAULT_EST_HOURS } from '@/lib/dispatch/capacity';

export type SuggestTechInput = {
  id: string;
  full_name: string | null;
  skills?: string[] | null;
  last_lat?: number | null;
  last_lng?: number | null;
};

export type SuggestJobInput = {
  job_type?: string | null;
  est_hours?: number | null;
  required_skills?: string[] | null;
  /** Job site coords when known (prior check-in / geocode) */
  site_lat?: number | null;
  site_lng?: number | null;
};

export type TechLoad = {
  jobCount: number;
  hours: number;
};

export type TechSuggestion = {
  techId: string;
  name: string;
  skillScore: number;
  missing: string[];
  loadHours: number;
  loadJobs: number;
  miles: number | null;
  /** Higher is better */
  rank: number;
  reason: string;
};

function techLatLng(tech: SuggestTechInput): LatLng | null {
  if (isValidLatLng(tech.last_lat, tech.last_lng)) {
    return { lat: tech.last_lat as number, lng: tech.last_lng as number };
  }
  return null;
}

function jobLatLng(job: SuggestJobInput): LatLng | null {
  if (isValidLatLng(job.site_lat, job.site_lng)) {
    return { lat: job.site_lat as number, lng: job.site_lng as number };
  }
  return null;
}

/**
 * Rank techs for a job:
 * skills (55%) + lighter load (25%) + closer last-known location (20%).
 */
export function suggestTechsForJob(
  job: SuggestJobInput,
  techs: SuggestTechInput[],
  loadByTech: Map<string, TechLoad>
): TechSuggestion[] {
  const required =
    job.required_skills?.length
      ? job.required_skills
      : skillsForJobType(job.job_type);

  const maxHours = Math.max(
    1,
    ...[...loadByTech.values()].map((l) => l.hours),
    Number(job.est_hours) || DEFAULT_EST_HOURS
  );

  const site = jobLatLng(job);

  return techs
    .map((tech) => {
      const { score, missing } = skillMatchScore(tech.skills, required);
      const load = loadByTech.get(tech.id) || { jobCount: 0, hours: 0 };
      const loadFactor = 1 - Math.min(1, load.hours / (maxHours + 2));
      const techLoc = techLatLng(tech);
      const prox = proximityScore(techLoc, site);
      const miles =
        techLoc && site ? haversineMiles(techLoc, site) : null;

      const rank = score * 0.55 + loadFactor * 0.25 + prox * 0.2;

      const parts: string[] = [];
      if (required.length) {
        parts.push(
          score >= 1
            ? 'skills match'
            : score > 0
              ? `${Math.round(score * 100)}% skills`
              : 'no skill match'
        );
      } else {
        parts.push('no skill filter');
      }
      parts.push(
        load.hours > 0
          ? `${load.hours.toFixed(1)}h today`
          : 'light load'
      );
      if (miles != null) {
        parts.push(formatMiles(miles) || `${Math.round(miles)} mi`);
      } else if (techLoc && !site) {
        parts.push('loc known');
      } else if (!techLoc) {
        parts.push('no loc yet');
      }

      return {
        techId: tech.id,
        name: tech.full_name || 'Tech',
        skillScore: score,
        missing,
        loadHours: load.hours,
        loadJobs: load.jobCount,
        miles,
        rank,
        reason: parts.join(' · '),
      };
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        (a.miles ?? 999) - (b.miles ?? 999) ||
        a.loadHours - b.loadHours
    );
}

export function buildDayLoad(
  jobs: {
    assigned_to: string | null;
    est_hours: number | null;
    scheduled_start: string | null;
    status: string | null;
  }[],
  dayKey: string
): Map<string, TechLoad> {
  const map = new Map<string, TechLoad>();
  for (const job of jobs) {
    if (!job.assigned_to || job.status === 'Cancelled') continue;
    if (!job.scheduled_start) continue;
    const key = job.scheduled_start.slice(0, 10);
    const local = new Date(job.scheduled_start);
    const localKey = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    if (dayKey && localKey !== dayKey && key !== dayKey) continue;
    const row = map.get(job.assigned_to) || { jobCount: 0, hours: 0 };
    row.jobCount += 1;
    row.hours += Number(job.est_hours) || DEFAULT_EST_HOURS;
    map.set(job.assigned_to, row);
  }
  return map;
}
