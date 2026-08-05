'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProductMark } from '@/components/brand/ProductMark';
import { SignOutButton } from '@/components/SignOutButton';
import { roleLabel, type AppRole } from '@/lib/roles';

type NavItem = { href: string; label: string };

function linkClass(active: boolean) {
  return [
    'inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition',
    active
      ? 'bg-brand-50 text-brand-800'
      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
  ].join(' ');
}

function chromeLinkClass(active: boolean) {
  return [
    'inline-flex min-h-11 items-center rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold',
    active
      ? 'border-brand-200 bg-brand-50 text-brand-800'
      : 'text-ink-800 hover:bg-ink-50',
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

  function isActive(href: string) {
    if (href === '/dashboard' || href === '/tech') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Avoid duplicating Help/Settings that already live in the chrome row
  const wrapItems = items.filter((item) => {
    if (helpHref && item.href === helpHref) return false;
    if (settingsHref && item.href === settingsHref) return false;
    return true;
  });

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

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {trailing}
          {helpHref && (
            <Link
              href={helpHref}
              className={chromeLinkClass(isActive(helpHref))}
            >
              Help
            </Link>
          )}
          {settingsHref && (
            <Link
              href={settingsHref}
              className={chromeLinkClass(isActive(settingsHref))}
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
        </div>
      </div>

      {wrapItems.length > 0 && (
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-[1400px] flex-wrap gap-1 border-t border-ink-100 px-3 py-1.5 sm:px-6"
        >
          {wrapItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
