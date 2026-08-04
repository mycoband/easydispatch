'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ProductMark } from '@/components/brand/ProductMark';
import { SignOutButton } from '@/components/SignOutButton';
import { roleLabel, type AppRole } from '@/lib/roles';

type NavItem = { href: string; label: string };

const PRIMARY_HREFS = new Set([
  '/dashboard',
  '/dashboard/dispatch',
  '/dashboard/calendar',
  '/dashboard/jobs',
  '/dashboard/customers',
  '/dashboard/invoices',
  '/tech',
]);

function linkClass(active: boolean, compact = false) {
  return [
    compact ? 'px-3 py-2 text-sm' : 'px-3 py-2 text-sm',
    'whitespace-nowrap rounded-md font-medium transition',
    active
      ? 'bg-brand-50 text-brand-800'
      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
  ].join(' ');
}

export function AppNav({
  brandHref,
  items,
  profile,
  dense = false,
  companyName = 'Company',
  companyLogoUrl = null,
  settingsHref,
  helpHref,
  trailing,
}: {
  brandHref: string;
  items: NavItem[];
  profile: { full_name: string | null; role: AppRole };
  dense?: boolean;
  /** Shop / tenant trade name (e.g. DC Refrigeration) */
  companyName?: string;
  companyLogoUrl?: string | null;
  settingsHref?: string;
  helpHref?: string;
  /** Extra controls before profile (e.g. Technician view toggle) */
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = items.filter(
    (i) =>
      PRIMARY_HREFS.has(i.href) ||
      i.href === '/dashboard/day-sheet' ||
      i.href.startsWith('/tech')
  );
  const primaryItems =
    primary.length >= 3
      ? items.filter((i) => primary.some((p) => p.href === i.href)).slice(0, 5)
      : items.slice(0, 5);
  const moreItems = items.filter(
    (i) => !primaryItems.some((p) => p.href === i.href)
  );

  function isActive(href: string) {
    if (href === '/dashboard' || href === '/tech') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur">
      <div
        className={`mx-auto flex max-w-[1400px] items-center gap-3 px-4 ${
          dense ? 'h-14' : 'h-16'
        } sm:px-6`}
      >
        <Link
          href={brandHref}
          className="flex min-w-0 shrink-0 items-center gap-2.5"
        >
          <ProductMark className={dense ? 'h-7 w-7' : 'h-8 w-8'} />
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-sm font-semibold tracking-tight text-ink-950 sm:text-[15px]">
              EasyDispatch
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-ink-500">
              {companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm object-contain"
                />
              ) : null}
              <span className="truncate">{companyName}</span>
            </span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {trailing}
          {helpHref && (
            <Link
              href={helpHref}
              className={`hidden min-h-11 items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold sm:inline-flex ${
                isActive(helpHref)
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'text-ink-800 hover:bg-ink-50'
              }`}
            >
              Help
            </Link>
          )}
          {settingsHref && (
            <Link
              href={settingsHref}
              className={`hidden min-h-11 items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold sm:inline-flex ${
                isActive(settingsHref)
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'text-ink-800 hover:bg-ink-50'
              }`}
            >
              Settings
            </Link>
          )}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-ink-900">
              {profile.full_name || 'User'}
            </p>
            <p className="text-xs text-ink-500">{roleLabel(profile.role)}</p>
          </div>
          <SignOutButton />
          <button
            type="button"
            className="min-h-11 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-800 md:hidden"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            More
          </button>
        </div>
      </div>

      <nav className="board-scroll flex gap-1 border-t border-ink-100 px-2 py-1 md:hidden">
        {primaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={linkClass(isActive(item.href), true) + ' min-h-11 inline-flex items-center'}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {moreOpen && (
        <div className="border-t border-ink-100 bg-white px-3 py-2 md:hidden">
          <div className="flex flex-wrap gap-1">
            {/* Full destination list — same IA as desktop nav */}
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  linkClass(isActive(item.href), true) +
                  ' min-h-11 inline-flex items-center'
                }
                onClick={() => setMoreOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {helpHref && (
              <Link
                href={helpHref}
                className={
                  linkClass(isActive(helpHref), true) +
                  ' min-h-11 inline-flex items-center'
                }
                onClick={() => setMoreOpen(false)}
              >
                Help
              </Link>
            )}
            {settingsHref && (
              <Link
                href={settingsHref}
                className={
                  linkClass(isActive(settingsHref), true) +
                  ' min-h-11 inline-flex items-center'
                }
                onClick={() => setMoreOpen(false)}
              >
                Settings
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
