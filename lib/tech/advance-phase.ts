import type { TechJobPhase } from '@/lib/tech/job-phases';

type PhaseRouter = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

/** On a tech job ticket, set `?phase=` without a full navigation away. */
export function setTechJobPhase(
  pathname: string,
  router: PhaseRouter,
  phase: TechJobPhase
) {
  if (!pathname.includes('/tech/jobs/')) return;
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  params.set('phase', phase);
  router.replace(`${pathname}?${params.toString()}`, { scroll: true });
}
