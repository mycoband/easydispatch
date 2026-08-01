import Link from 'next/link';

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 7h16M4 12h10M4 17h7"
          />
        </svg>
      </div>
      <p className="font-display text-base font-semibold text-ink-900">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-ink-500">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Link
              href={action.href}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
