'use client';

import { useEffect, useState } from 'react';
import {
  isAndroid,
  isIosSafari,
  isStandaloneDisplay,
} from '@/lib/ui/platform';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'ed-install-dismissed';

/**
 * Cross-platform install hint: Chromium Install prompt, or iOS Add to Home Screen tip.
 */
export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneDisplay()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (isIosSafari()) {
      setShowIos(true);
      setVisible(true);
    } else if (isAndroid()) {
      // Android may fire beforeinstallprompt; if not, still show tip after a beat
      const t = window.setTimeout(() => setVisible(true), 1200);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBip);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (!visible || isStandaloneDisplay()) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="safe-pad-x border-b border-brand-100 bg-brand-50/90 px-4 py-2.5 text-sm text-brand-950">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 leading-snug">
          {showIos && !deferred ? (
            <>
              <span className="font-semibold">Install EasyDispatch: </span>
              tap Share, then <span className="font-semibold">Add to Home Screen</span>
              — same app as on computer.
            </>
          ) : deferred ? (
            <>
              <span className="font-semibold">Install EasyDispatch </span>
              for a full-screen app on this device (same as phone &amp; computer).
            </>
          ) : (
            <>
              <span className="font-semibold">Tip: </span>
              Install EasyDispatch from your browser menu for a home-screen app
              that matches phone and computer.
            </>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {deferred && (
            <button
              type="button"
              onClick={install}
              className="min-h-11 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
