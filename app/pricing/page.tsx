import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaRow } from '@/components/marketing/CtaRow';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PLANS } from '@/lib/billing/plans';
import { MARKETING_ORIGIN, SITE_NAME, SUPPORT_EMAIL } from '@/lib/site';

const title = 'Pricing';
const description =
  'EasyDispatch Starter and Pro are self-serve after you sign in. Enterprise is a later release. Start a 14-day trial when you create a company.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${MARKETING_ORIGIN}/pricing` },
  openGraph: {
    title: `${title} · ${SITE_NAME}`,
    description,
    url: `${MARKETING_ORIGIN}/pricing`,
  },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
          Billing
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink-950">
          Plans from the product
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">
          These tiers are the same ones in Settings → Billing. Checkout happens
          after you sign in — this page does not invent a second price list.
          New companies start a 14-day trial.
        </p>
        <CtaRow className="mt-8" primaryLabel="Start free trial" />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`panel flex flex-col p-6 ${
                plan.id === 'enterprise'
                  ? 'border-violet-200 ring-1 ring-violet-100'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {plan.name}
                </p>
                {plan.comingSoon ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                    Later release
                  </span>
                ) : null}
              </div>
              <p className="mt-2 font-display text-3xl font-semibold text-ink-950">
                {plan.priceLabel}
              </p>
              <p className="mt-2 text-sm text-ink-500">{plan.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-brand-600" aria-hidden>
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.comingSoon ? (
                <p className="mt-6 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-sm font-medium text-violet-950">
                  Contact{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="underline hover:no-underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  when Enterprise is ready.
                </p>
              ) : (
                <Link
                  href="/login?mode=signup"
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Start with {plan.name}
                </Link>
              )}
            </article>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ink-500">
          Customer invoice payments (job Stripe links) are separate from your
          EasyDispatch subscription. Seat limits and checkout live in the app
          under Settings → Billing.{' '}
          <Link href="/faq" className="font-medium text-brand-700 hover:underline">
            Billing FAQ
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
