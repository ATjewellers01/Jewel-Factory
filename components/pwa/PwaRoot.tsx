'use client';

import { Plus, Share, SquarePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId } from 'react';

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { closeIosInstallSheet } from '@/lib/pwa';

/**
 * Mounted once in the root layout. Registers the service worker (production
 * only, so `pnpm dev` never gets a stale worker) and hosts the iPhone/iPad
 * "Add to Home Screen" instructions, which outlive the menu that opened them.
 */
export function PwaRoot() {
  const { iosSheetOpen } = usePwaInstall();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed', error);
    });
  }, []);

  return iosSheetOpen ? <IosInstallSheet onClose={closeIosInstallSheet} /> : null;
}

function IosInstallSheet({ onClose }: { onClose: () => void }) {
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

  const steps = [
    { icon: Share, text: <>Tap the <b>Share</b> button in the browser toolbar.</> },
    { icon: SquarePlus, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
    { icon: Plus, text: <>Tap <b>Add</b> in the top-right corner.</> },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-[#fbf8f1] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <div>
              <h2 id={titleId} className="text-base font-semibold text-[#211c17]">Install Jewel Factory</h2>
              <p className="text-xs text-[#80756a]">Add it to your Home Screen to open it like an app.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#544b43] hover:bg-black/5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <ol className="mt-5 space-y-3">
          {steps.map(({ icon: Icon, text }, index) => (
            <li key={index} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-[#544b43]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#211c17] text-[11px] font-bold text-[#efd489]">{index + 1}</span>
              <span className="flex-1">{text}</span>
              <Icon className="h-5 w-5 shrink-0 text-[#2f7cf6]" />
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-[#80756a]">
          In Chrome on iPhone, the Share button is in the address bar. The installed app keeps its own sign-in, so you&apos;ll log in once inside it.
        </p>

        <button onClick={onClose} className="mt-5 w-full rounded-full bg-[#211c17] py-3 text-sm font-semibold text-[#fffaf0]">Got it</button>
      </div>
    </div>
  );
}
