import { cn } from '@/lib/utils';

/**
 * EasyDispatch “Signal” mark — product logo glyph.
 * Always represents EasyDispatch (the software), not the shop’s trade name.
 */
export function ProductMark({
  className,
  title = 'EasyDispatch Signal',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-8 shrink-0', className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="32" height="32" rx="8" className="fill-ink-900" />
      {/* Route spine */}
      <path
        d="M9 22.5V12.2c0-1.2.7-2.3 1.8-2.8L16 7.5l5.2 1.9c1.1.5 1.8 1.6 1.8 2.8v10.3"
        className="stroke-white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dispatch pulse / signal arcs */}
      <path
        d="M12.2 16.2c1-.9 2.3-1.4 3.8-1.4s2.8.5 3.8 1.4"
        className="stroke-brand-300"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.6 19c.7-.6 1.5-.9 2.4-.9s1.7.3 2.4.9"
        className="stroke-brand-300"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Active node */}
      <circle cx="16" cy="21.5" r="2.1" className="fill-brand-400" />
    </svg>
  );
}

/** Compact product lockup: Signal + EasyDispatch wordmark */
export function ProductLockup({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const markClass =
    size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const textClass =
    size === 'lg'
      ? 'text-2xl'
      : size === 'sm'
        ? 'text-base'
        : 'text-lg';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <ProductMark className={markClass} />
      <span
        className={cn(
          'font-display font-semibold tracking-tight text-ink-950',
          textClass
        )}
      >
        EasyDispatch
      </span>
    </span>
  );
}
