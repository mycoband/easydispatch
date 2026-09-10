import Link from 'next/link';
import { cn } from '@/lib/utils';

export function CtaRow({
  className,
  primaryLabel = 'Open app',
  align = 'start',
}: {
  className?: string;
  primaryLabel?: string;
  align?: 'start' | 'center';
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center',
        align === 'center' && 'sm:justify-center',
        className
      )}
    >
      <Link
        href="/login"
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        {primaryLabel}
      </Link>
      <Link
        href="/faq"
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
      >
        See FAQ
      </Link>
    </div>
  );
}
