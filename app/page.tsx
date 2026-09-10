import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaRow } from '@/components/marketing/CtaRow';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { ProductPreview } from '@/components/marketing/ProductPreview';
import {
  HOW_IT_WORKS,
  MARKETING_FAQ,
  OFFICE_FEATURES,
  PLATFORMS,
  TECH_FEATURES,
  VALUE_PROPS,
} from '@/lib/marketing/content';
import {
  MARKETING_ORIGIN,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: MARKETING_ORIGIN },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: MARKETING_ORIGIN,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: MARKETING_ORIGIN,
  description: SITE_DESCRIPTION,
  offers: {
    '@type': 'Offer',
    url: `${MARKETING_ORIGIN}/pricing`,
    availability: 'https://schema.org/OnlineOnly',
  },
};

export default function MarketingHomePage() {
  const officePreview = OFFICE_FEATURES.slice(0, 8);
  const techPreview = TECH_FEATURES.slice(0, 6);

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
            HVAC shops
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl sm:leading-[1.1]">
            {SITE_TAGLINE}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
            One product for the office and the truck. Live dispatch with Assign
            for me, an AI receptionist that opens a ticket, and a technician run
            sheet that ends in wrap-up — not a pile of texts.
          </p>
          <CtaRow className="mt-8" />
          <p className="mt-4 text-sm text-ink-500">
            Web and PWA are live.{' '}
            <Link href="/features" className="font-medium text-brand-700 hover:underline">
              See what is in the product
            </Link>
            .
          </p>
        </div>
        <ProductPreview />
      </section>

      <section className="border-y border-ink-200/70 bg-white/70">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-2">
          {VALUE_PROPS.map((item) => (
            <article key={item.title} className="panel p-6">
              <h2 className="font-display text-lg font-semibold text-ink-950">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
              In the product
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-950">
              Office and field, same job
            </h2>
          </div>
          <Link
            href="/features"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            All capabilities
          </Link>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <FeatureList title="Office" items={officePreview} />
          <FeatureList title="Technician" items={techPreview} />
        </div>
      </section>

      <section className="bg-ink-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-300">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            From the phone line to paid
          </h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <article
                key={step.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">
                  {String(index + 1).padStart(2, '0')} · {step.eyebrow}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-200">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
          Platforms
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-950">
          Use it now in the browser. Native apps next.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((platform) => (
            <article key={platform.name} className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-ink-950">
                  {platform.name}
                </h3>
                <span
                  className={
                    platform.status === 'Live'
                      ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
                      : 'rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-600'
                  }
                >
                  {platform.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {platform.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-ink-200/70 bg-white/70">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-950">
            Questions shops actually ask
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Short answers here.{' '}
            <Link href="/faq" className="font-medium text-brand-700 hover:underline">
              Full product FAQ
            </Link>{' '}
            covers every feature module.
          </p>
          <div className="mt-8 space-y-3">
            {MARKETING_FAQ.map((item) => (
              <details
                key={item.question}
                className="panel group open:shadow-md"
              >
                <summary className="cursor-pointer list-none px-5 py-4 font-display text-base font-semibold text-ink-950 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="text-ink-400 group-open:hidden" aria-hidden>
                      +
                    </span>
                    <span className="hidden text-ink-400 group-open:inline" aria-hidden>
                      −
                    </span>
                  </span>
                </summary>
                <p className="border-t border-ink-100 px-5 py-4 text-sm leading-relaxed text-ink-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-600">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
            Open the office. Hand the tech a run sheet.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-brand-50">
            Sign in to the live web app, or read how each module works before
            you invite the shop.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              Open app
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10"
            >
              See FAQ
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function FeatureList({
  title,
  items,
}: {
  title: string;
  items: readonly { title: string; body: string }[];
}) {
  return (
    <div>
      <h3 className="font-display text-xl font-semibold text-ink-950">{title}</h3>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.title} className="border-l-2 border-brand-200 pl-4">
            <p className="font-semibold text-ink-900">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
