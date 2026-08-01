import Link from 'next/link';
import { FaqAccordion } from '@/components/help/FaqAccordion';
import {
  COMPANY_MODULES,
  MODULE_GROUPS,
} from '@/lib/company/modules';

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
          Browse questions on customers, jobs, feature modules, costing, and
          more. Office owners toggle features in Settings → Feature modules
          (every module is listed below). For live help while you work, use the{' '}
          <span className="font-medium text-slate-800">Help</span> button
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

      <section className="max-w-3xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Feature modules ({COMPANY_MODULES.length})
        </h2>
        <p className="text-sm text-slate-600">
          Same list as Settings → Feature modules. Each also has a FAQ answer
          under Settings & modules.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_GROUPS.map((group) => {
            const items = COMPANY_MODULES.filter((m) => m.group === group);
            if (!items.length) return null;
            return (
              <div
                key={group}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {items.map((m) => (
                    <li key={m.id} className="text-sm text-slate-800">
                      <span className="font-medium">{m.label}</span>
                      <span className="block text-xs text-slate-500">
                        {m.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="max-w-2xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">FAQ</h2>
        <FaqAccordion />
      </div>
    </div>
  );
}
