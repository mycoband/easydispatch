'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Clickable table row that navigates to a job (whole row, not just Open). */
export function JobTableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      className={cn(
        'group cursor-pointer border-b border-ink-100 last:border-0 hover:bg-ink-50/70 focus-visible:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40',
        className
      )}
    >
      {children}
    </tr>
  );
}
