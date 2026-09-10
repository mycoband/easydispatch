import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqAccordion } from '@/components/help/FaqAccordion';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { MARKETING_ORIGIN, SITE_NAME } from '@/lib/site';

const title = 'FAQ';
const description =
  'Common questions about EasyDispatch HVAC field service software — customers, jobs, modules, costing, estimates, and the tech app.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${MARKETING_ORIGIN}/faq` },
  openGraph: {
    title: `${title} · ${SITE_NAME}`,
    description,
    url: `${MARKETING_ORIGIN}/faq`,
  },
};

export default function PublicFaqPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-950">
            FAQ
          </h1>
          <p className="text-sm text-ink-600">
            Customers, jobs, every Feature module toggle, costing, estimates,
            tech app, and settings. Signed-in users also get Help & FAQ plus
            the Help chat button (bottom-right). For a shorter overview, see
            the{' '}
            <Link href="/" className="font-medium text-brand-700 hover:underline">
              homepage
            </Link>
            .
          </p>
        </header>

        <FaqAccordion />

        <p className="mt-10 text-center text-xs text-ink-400">
          Still stuck? Sign in and open Help to ask the AI assistant.
        </p>
      </div>
    </MarketingShell>
  );
}
