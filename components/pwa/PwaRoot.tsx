'use client';

import { ArrowUp, Download, EllipsisVertical, MonitorDown, Plus, Share, SquarePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId } from 'react';

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { closeInstallSheet, promptInstall } from '@/lib/pwa';

/**
 * Mounted once in the root layout. Registers the service worker (production
 * only, so `pnpm dev` never gets a stale worker) and hosts the manual
 * install instructions (iPhone/iPad, Android, desktop), which outlive the
 * menu that opened them.
 */
export function PwaRoot() {
  const { installSheetOpen, isIos, isIosChrome, isAndroid } = usePwaInstall();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed', error);
    });
  }, []);

  if (!installSheetOpen) return null;
  const platform = isIosChrome ? 'iosChrome' : isIos ? 'ios' : isAndroid ? 'android' : 'desktop';
  return <InstallSheet platform={platform} onClose={closeInstallSheet} />;
}

// iOS share sheets show only a few actions at first; "Add to Home Screen"
// sits under "View More", which users miss without being told.
const STEPS = {
  iosChrome: [
    { icon: Share, text: <>Tap the <b>Share</b> icon at the top-right of the address bar.</> },
    { icon: Share, text: <>Tap <b>Share</b> at the top-right of the address bar.</> },
    { icon: SquarePlus, text: <>Tap <b>Add to Home Screen</b> (under <b>View More</b> if hidden).</> },
    { icon: Plus, text: <>Tap <b>Add</b>.</> },
  ],
  ios: [
    { icon: Share, text: <>Tap the <b>Share</b> button in the toolbar.</> },
    { icon: SquarePlus, text: <>Tap <b>Add to Home Screen</b> (under <b>View More</b> if hidden).</> },
    { icon: Plus, text: <>Tap <b>Add</b>.</> },
  ],
  android: [
    { icon: EllipsisVertical, text: <>Tap the <b>⋮ menu</b> at the top-right of the browser.</> },
    { icon: Download, text: <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</> },
    { icon: Plus, text: <>Tap <b>Install</b> to confirm.</> },
  ],
  desktop: [
    { icon: MonitorDown, text: <>Click the <b>install icon</b> at the right end of the address bar.</> },
    { icon: EllipsisVertical, text: <>Or open the browser <b>⋮ menu</b> and choose <b>Install Jewel Factory</b>.</> },
    { icon: Plus, text: <>Click <b>Install</b> to confirm.</> },
  ],
};

const NOTES = {
  iosChrome: 'The installed app keeps its own sign-in, so you\'ll log in once inside it.',
  ios: 'In Chrome on iPhone, the Share button is in the address bar. The installed app keeps its own sign-in, so you\'ll log in once inside it.',
  android: 'Use Chrome for the best result. If it\'s already installed, open Jewel Factory from your Home Screen.',
  desktop: 'Works in Chrome and Edge. If it\'s already installed, open Jewel Factory from your apps.',
};

function InstallSheet({ platform, onClose }: { platform: keyof typeof STEPS; onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // If Chrome's own install prompt becomes available while this sheet is open
  // (beforeinstallprompt can fire a moment after the user first tapped), offer
  // a real one-tap Install button instead of the manual steps — the steps
  // below are only a fallback for when Chrome gives us no prompt (iPhone
  // always, Android sometimes).
  const { canPrompt } = usePwaInstall();
  const steps = STEPS[platform];
  // Chrome on iPhone keeps Share in the top address bar, so the sheet drops
  // from the top with an arrow pointing at it instead of rising from below.
  const atTop = platform === 'iosChrome' && !canPrompt;

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-center bg-black/55 backdrop-blur-[2px] ${atTop ? 'items-start' : 'items-end sm:items-center sm:p-4'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {atTop ? (
        <span aria-hidden className="pointer-events-none absolute right-5 top-1 flex flex-col items-center text-[#efd489]">
          <ArrowUp className="h-7 w-7 animate-bounce" />
          <span className="text-[11px] font-semibold">Share</span>
        </span>
      ) : null}
      <div
        className={`w-full max-w-md bg-[#fbf8f1] p-6 shadow-2xl ${atTop ? 'mx-3 mt-14 rounded-3xl' : 'rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div>
              <h2 id={titleId} className="text-base font-semibold text-[#211c17]">Install Jewel Factory</h2>
              <p className="text-xs text-[#80756a]">Open it like an app, straight from your Home Screen.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#544b43] hover:bg-black/5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {canPrompt ? (
          <>
            <p className="mt-5 text-sm leading-relaxed text-[#544b43]">Tap below to install Jewel Factory on your device.</p>
            <button
              onClick={() => { void promptInstall().finally(onClose); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#211c17] py-3.5 text-sm font-semibold text-[#fffaf0]"
            >
              <Download className="h-4 w-4" /> Install now
            </button>
            <button onClick={onClose} className="mt-2 w-full rounded-full py-2.5 text-sm font-semibold text-[#80756a]">Not now</button>
          </>
        ) : (
          <>
            {/* These are things to do in the browser's OWN menu — not buttons
                on this sheet. Styled as a plain checklist so nobody taps a row
                expecting it to act (a real confusion we saw). */}
            <p className="mt-5 mb-3 text-xs font-semibold uppercase tracking-wide text-[#9a8f83]">Do this in your browser:</p>
            <ol className="space-y-2.5">
              {steps.map(({ icon: Icon, text }, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-[#544b43]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#211c17] text-[11px] font-bold text-[#efd489]">{index + 1}</span>
                  <span className="flex-1 leading-snug">{text}</span>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#b68a3e]" />
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-[#80756a]">{NOTES[platform]}</p>
            <p className="mt-2 rounded-xl bg-[#f3ece0] px-3 py-2 text-xs text-[#6f6459]">
              Already installed? Nothing will happen here — just open <b>Jewel Factory</b> from your Home Screen.
            </p>
            <button onClick={onClose} className="mt-4 w-full rounded-full bg-[#211c17] py-3 text-sm font-semibold text-[#fffaf0]">Got it</button>
          </>
        )}
      </div>
    </div>
  );
}
