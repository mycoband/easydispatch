import Link from 'next/link';
import { ProductLockup } from '@/components/brand/ProductMark';
import { MARKETING_NAV, SITE_TAGLINE, SUPPORT_EMAIL } from '@/lib/site';

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-200/80 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <ProductLockup size="sm" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
            {SITE_TAGLINE}. Web and PWA are live. Native Android, Windows, and
            iOS apps are coming soon.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {MARKETING_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="font-medium text-ink-700 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="font-medium text-ink-700 hover:text-brand-700"
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="font-medium text-ink-700 hover:text-brand-700"
              >
                Open app
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Legal
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/privacy"
                className="font-medium text-ink-700 hover:text-brand-700"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="font-medium text-ink-700 hover:text-brand-700"
              >
                Terms
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-ink-700 hover:text-brand-700"
              >
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-400 sm:px-6">
          © {new Date().getFullYear()} EasyDispatch. HVAC field service
          software.
        </p>
      </div>
    </footer>
  );
}
