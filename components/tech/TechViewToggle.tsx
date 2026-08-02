'use client';

import { useTransition } from 'react';
import {
  disableTechnicianView,
  enableTechnicianView,
} from '@/app/tech/view-mode-actions';
import { cn } from '@/lib/utils';

export function TechViewToggle({
  enabled,
  variant = 'nav',
  jobId,
  className,
}: {
  enabled: boolean;
  variant?: 'nav' | 'banner' | 'button';
  /** When enabling from an office job page, open that job in tech UI */
  jobId?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (enabled) await disableTechnicianView();
      else await enableTechnicianView(jobId);
    });
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950',
          className
        )}
      >
        <p>
          <span className="font-semibold">Technician view</span>
          {' — '}
          same screens field techs use. Actions use your office permissions.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
        >
          {pending ? 'Leaving…' : 'Exit to office'}
        </button>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={cn(
          'rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50',
          className
        )}
      >
        {pending
          ? 'Opening…'
          : enabled
            ? 'Exit technician view'
            : 'Open technician view'}
      </button>
    );
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50',
        pending && 'opacity-50',
        className
      )}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        checked={enabled}
        disabled={pending}
        onChange={toggle}
      />
      <span className="whitespace-nowrap">Tech view</span>
    </label>
  );
}
