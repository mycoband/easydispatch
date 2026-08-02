'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TechCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('space-y-3', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-left shadow-sm"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold text-ink-950">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-sm text-ink-500">{subtitle}</span>
          )}
        </span>
        <span
          className={cn(
            'shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400',
            open && 'text-brand-700'
          )}
        >
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}
