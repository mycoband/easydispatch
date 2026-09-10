import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaRow } from '@/components/marketing/CtaRow';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { OFFICE_FEATURES, TECH_FEATURES } from '@/lib/marketing/content';
import { MARKETING_ORIGIN, SITE_NAME } from '@/lib/site';

const title = 'Features';
const description =
  'Office dispatch, Assign-tech AI, AI receptionist, estimates, invoices, job costing, technician run sheets, walkthroughs, and more — the capabilities actually in EasyDispatch.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${MARKETING_ORIGIN}/features` },
  openGraph: {
    title: `${title} · ${SITE_NAME}`,
    description,
    url: `${MARKETING_ORIGIN}/features`,
  },
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
          Product
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink-950">
          What EasyDispatch actually does
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">
          These are the modules in the live office dashboard and technician app.
          Shops turn categories on or off in Settings. AI drafts and ranks —
          people still confirm assigns, send texts, and send invoices.
        </p>
        <CtaRow className="mt-8" />

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink-950">
            Office
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Dispatch, money, customers, and the shop phone line.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICE_FEATURES.map((item) => (
              <article key={item.title} className="panel p-5">
                <h3 className="font-display text-base font-semibold text-ink-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink-950">
            Technician
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            The field ticket — same product, assigned jobs only.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_FEATURES.map((item) => (
              <article key={item.title} className="panel p-5">
                <h3 className="font-display text-base font-semibold text-ink-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-12 text-sm text-ink-500">
          Want the how-to for every toggle?{' '}
          <Link href="/faq" className="font-medium text-brand-700 hover:underline">
            Read the product FAQ
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
