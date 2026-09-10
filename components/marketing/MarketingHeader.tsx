'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ProductLockup } from '@/components/brand/ProductMark';
import { MARKETING_NAV } from '@/lib/site';
import { cn } from '@/lib/utils';

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-ink-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          onClick={() => setOpen(false)}
        >
          <ProductLockup size="sm" />
        </Link>

        <nav
          className="ml-4 hidden items-center gap-1 md:flex"
          aria-label="Marketing"
        >
          {MARKETING_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition',
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Open app
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:ml-0 md:hidden">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 sm:hidden"
          >
            Open app
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-800 hover:bg-ink-50"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-ink-100 bg-white px-4 py-3 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Marketing mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Sign in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}
