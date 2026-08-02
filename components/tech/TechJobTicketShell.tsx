'use client';

import {
  Suspense,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LiveStatus } from '@/lib/jobs/time-tracking';
import {
  isTechJobPhase,
  phaseFromLiveStatus,
  TECH_JOB_PHASES,
  type TechJobPhase,
} from '@/lib/tech/job-phases';
import { cn } from '@/lib/utils';

type StickyConfig = {
  hint: string;
  primaryLabel: string;
  primaryPhase?: TechJobPhase;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryPhase?: TechJobPhase;
};

function stickyForPhase(
  phase: TechJobPhase,
  liveStatus: LiveStatus,
  wrapStickyHint?: string
): StickyConfig {
  if (phase === 'arrive') {
    return {
      hint:
        liveStatus === 'En Route'
          ? 'Tap Arrive — you’ll move to Work automatically'
          : liveStatus === 'On Site'
            ? 'You’re on site — continue to Work'
            : 'Start Drive, then Arrive (auto-opens Work)',
      primaryLabel: 'Continue to Work',
      primaryPhase: 'work',
    };
  }
  if (phase === 'work') {
    return {
      hint: 'Record → Generate → Apply & wrap up',
      primaryLabel: 'Go to Wrap up',
      primaryPhase: 'wrap',
      secondaryLabel: 'Back to Arrive',
      secondaryPhase: 'arrive',
    };
  }
  return {
    hint:
      wrapStickyHint ||
      (liveStatus === 'Completed'
        ? 'Sign, invoice, then you’re done'
        : 'Clock out moves you here — then sign & pay'),
    primaryLabel: 'Back to My jobs',
    primaryHref: '/tech',
    secondaryLabel: 'Back to Work',
    secondaryPhase: 'work',
  };
}

function TechJobTicketShellInner({
  liveStatus,
  header,
  arrive,
  work,
  wrap,
  wrapStickyHint,
}: {
  liveStatus: LiveStatus;
  header: ReactNode;
  arrive: ReactNode;
  work: ReactNode;
  wrap: ReactNode;
  wrapStickyHint?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultPhase = phaseFromLiveStatus(liveStatus);

  const phaseFromUrl = searchParams.get('phase');
  const phase: TechJobPhase = isTechJobPhase(phaseFromUrl)
    ? phaseFromUrl
    : defaultPhase;

  const setPhase = useCallback(
    (next: TechJobPhase) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('phase', next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: true });
    },
    [pathname, router, searchParams]
  );

  const body = useMemo(() => {
    if (phase === 'work') return work;
    if (phase === 'wrap') return wrap;
    return arrive;
  }, [arrive, phase, work, wrap]);

  const sticky = stickyForPhase(phase, liveStatus, wrapStickyHint);

  return (
    <div className="space-y-5 pb-28">
      {header}

      <div
        className="sticky top-14 z-30 rounded-xl border border-ink-200 bg-white/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90"
        role="tablist"
        aria-label="Job phases"
      >
        <div className="grid grid-cols-3 gap-1">
          {TECH_JOB_PHASES.map((p) => {
            const active = phase === p.id;
            const suggested = defaultPhase === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPhase(p.id)}
                className={cn(
                  'rounded-lg px-2 py-2.5 text-center text-sm font-semibold transition',
                  active
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:bg-ink-50',
                  !active && suggested && 'ring-1 ring-brand-300'
                )}
              >
                <span className="block text-[10px] font-medium opacity-70">
                  {p.short}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div key={phase} role="tabpanel" className="space-y-5">
        {body}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="pointer-events-auto border-t border-ink-200 bg-white/95 px-4 py-3 pr-20 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:pr-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-500 sm:max-w-[40%]">{sticky.hint}</p>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {sticky.secondaryLabel && sticky.secondaryPhase && (
                <button
                  type="button"
                  onClick={() => setPhase(sticky.secondaryPhase!)}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  {sticky.secondaryLabel}
                </button>
              )}
              {sticky.primaryHref ? (
                <Link
                  href={sticky.primaryHref}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {sticky.primaryLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    sticky.primaryPhase && setPhase(sticky.primaryPhase)
                  }
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {sticky.primaryLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TechJobTicketShell(props: {
  liveStatus: LiveStatus;
  header: ReactNode;
  arrive: ReactNode;
  work: ReactNode;
  wrap: ReactNode;
  /** Finish-this-stop hint for Wrap sticky footer */
  wrapStickyHint?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 pb-28">
          {props.header}
          <div className="h-14 animate-pulse rounded-xl bg-ink-100" />
          <div className="space-y-5">{props.arrive}</div>
        </div>
      }
    >
      <TechJobTicketShellInner {...props} />
    </Suspense>
  );
}
