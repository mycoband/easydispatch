'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { HelpChat } from '@/components/help/HelpChat';
import { cn } from '@/lib/utils';

type Props = {
  faqHref?: string;
};

/**
 * Floating help bot available on every authenticated page.
 * Conversation is kept in sessionStorage so it survives navigation.
 */
export function HelpChatWidget({ faqHref = '/faq' }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  /** Tech job ticket has a sticky CTA footer — lift help above it */
  const aboveTicketFooter = Boolean(
    pathname?.match(/^\/tech\/jobs\/[^/]+/)
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [open]);

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-4 z-50 flex flex-col items-end gap-3 sm:right-6',
        aboveTicketFooter
          ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
          : 'bottom-20 sm:bottom-20'
      )}
    >
      {open ? (
        <div
          className="pointer-events-auto w-[min(100vw-2rem,24rem)] overflow-hidden"
          style={{ height: 'min(32rem, calc(100vh - 6.5rem))' }}
          role="dialog"
          aria-label="EasyDispatch help chat"
        >
          <HelpChat
            variant="panel"
            faqHref={faqHref}
            onClose={() => setOpen(false)}
            className="h-full"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition',
          'bg-brand-600 text-white hover:bg-brand-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40',
          open && 'bg-ink-800 hover:bg-ink-700'
        )}
        aria-expanded={open}
        aria-controls="help-chat-panel"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-base leading-none"
          aria-hidden
        >
          {open ? '✕' : '?'}
        </span>
        <span className="hidden sm:inline">{open ? 'Close help' : 'Help'}</span>
      </button>
    </div>
  );
}
