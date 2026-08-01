import Link from 'next/link';
import { FaqAccordion } from '@/components/help/FaqAccordion';

type Props = {
  /** Logged-in home for “back” context */
  homeHref: string;
  homeLabel?: string;
};

export function HelpPage({ homeHref, homeLabel = 'Dashboard' }: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Support
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-950">
          Help & FAQ
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Browse questions on customers, jobs, job costing, reports, estimates,
          and more. For live help while you work, use the{' '}
          <span className="font-medium text-slate-800">Help</span> button in the
          bottom-right — the AI bot uses this FAQ. Public copy:{' '}
          <Link href="/faq" className="font-medium text-sky-700 underline">
            /faq
          </Link>
          .
        </p>
        <p className="text-xs text-slate-400">
          <Link href={homeHref} className="hover:text-slate-600">
            ← Back to {homeLabel}
          </Link>
        </p>
      </header>

      <div className="max-w-2xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">FAQ</h2>
        <FaqAccordion />
      </div>
    </div>
  );
}
