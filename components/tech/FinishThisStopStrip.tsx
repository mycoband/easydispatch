'use client';

import Link from 'next/link';
import {
  type CloseoutGap,
  firstIncompleteCloseoutGap,
} from '@/lib/jobs/closeout-gaps';
import { cn } from '@/lib/utils';

export function FinishThisStopStrip({ gaps }: { gaps: CloseoutGap[] }) {
  const current = firstIncompleteCloseoutGap(gaps);
  const stopComplete = !current;
  const unpaid = gaps.find((g) => g.id === 'paid' && !g.done);

  function jump(anchor: string) {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.focus?.({ preventScroll: true });
    }
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
            Finish this stop
          </p>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            {stopComplete
              ? unpaid
                ? 'Almost done — collect payment'
                : 'Stop complete'
              : 'Close out in order'}
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {stopComplete
              ? unpaid
                ? unpaid.hint
                : 'Back to My jobs when you’re ready'
              : current?.hint}
          </p>
        </div>
        {stopComplete && (
          <Link
            href="/tech"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Back to My jobs
          </Link>
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {gaps.map((g, i) => {
          const isCurrent = current?.id === g.id;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => jump(g.anchor)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                  g.done
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : isCurrent
                      ? 'border-brand-400 bg-white ring-2 ring-brand-200'
                      : 'border-ink-100 bg-white hover:border-ink-200'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    g.done
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-100 text-ink-500'
                  )}
                  aria-hidden
                >
                  {g.done ? '✓' : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      g.done ? 'text-emerald-900' : 'text-ink-900'
                    )}
                  >
                    {g.label}
                    {g.blocked && !g.done ? (
                      <span className="ml-2 text-xs font-medium text-amber-700">
                        Blocked
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {g.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
