import type { LiveStatus } from '@/lib/jobs/time-tracking';

export type TechJobPhase = 'arrive' | 'work' | 'wrap';

export const TECH_JOB_PHASES: {
  id: TechJobPhase;
  label: string;
  short: string;
}[] = [
  { id: 'arrive', label: 'Arrive', short: '1' },
  { id: 'work', label: 'Work', short: '2' },
  { id: 'wrap', label: 'Wrap up', short: '3' },
];

export function isTechJobPhase(value: string | null | undefined): value is TechJobPhase {
  return value === 'arrive' || value === 'work' || value === 'wrap';
}

/** Default ticket phase from live visit status. */
export function phaseFromLiveStatus(status: LiveStatus): TechJobPhase {
  if (status === 'Completed' || status === 'Cancelled') return 'wrap';
  if (status === 'On Site') return 'work';
  return 'arrive';
}

/** Short hint for the My jobs list. */
export function nextActionHint(status: LiveStatus): string {
  switch (status) {
    case 'En Route':
      return 'Arrive on site';
    case 'On Site':
      return 'Work the job';
    case 'Completed':
      return 'Wrap up';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return 'Start drive';
  }
}
